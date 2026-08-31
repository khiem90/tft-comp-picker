import fs from "node:fs";
import path from "node:path";
import type { SetDataResponse } from "../shared/types";
import type { SourceFetcher } from "./sources";

// One icon a Refresh should hold locally: which catalog it belongs to, the
// apiName that keys its file, and the game-relative .png path to fetch it
// from. kind doubles as the directory name under /icons.
export interface IconJob {
  kind: "units" | "traits" | "items" | "components";
  apiName: string;
  sourcePath: string;
}

function jobKey(job: IconJob): string {
  return `${job.kind}/${job.apiName}`;
}

function jobFile(dataDir: string, job: IconJob): string {
  return path.join(dataDir, "icons", job.kind, `${job.apiName}.png`);
}

// Keeps a burst of ~175 downloads polite to the mirror and bounded in memory,
// while still finishing in a few round-trip times.
const DOWNLOAD_CONCURRENCY = 8;

export interface DownloadIconsOptions {
  dataDir: string;
  jobs: IconJob[];
  fetcher: SourceFetcher;
  // True when this Refresh crossed a Patch boundary, or when the previous
  // Patch is unknowable. Icons are Set data, so either way every file on
  // disk is stale: the whole directory is replaced.
  patchChanged: boolean;
}

// Brings the local icon store in line with the jobs and reports which icons
// are actually on disk afterwards, keyed kind/apiName. Files already present
// are kept without a fetch (icons only change across Patches); everything
// else downloads. A failed download only costs that icon: it stays absent,
// the Refresh goes on, and the next same-Patch Refresh retries it.
export async function downloadIcons({
  dataDir,
  jobs,
  fetcher,
  patchChanged,
}: DownloadIconsOptions): Promise<Set<string>> {
  const iconsDir = path.join(dataDir, "icons");
  if (patchChanged) fs.rmSync(iconsDir, { recursive: true, force: true });

  const available = new Set<string>();
  const pending: IconJob[] = [];
  for (const job of jobs) {
    if (fs.existsSync(jobFile(dataDir, job))) {
      available.add(jobKey(job));
    } else {
      pending.push(job);
    }
  }
  if (!fetcher.fetchIcon || pending.length === 0) return available;

  const download = async (job: IconJob): Promise<void> => {
    try {
      const bytes = await fetcher.fetchIcon!(job.sourcePath);
      const target = jobFile(dataDir, job);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      // Write-then-rename, like the JSON files: a crash mid-write must never
      // leave a torn PNG that the payload then points at.
      const temp = `${target}.tmp`;
      fs.writeFileSync(temp, bytes);
      fs.renameSync(temp, target);
      available.add(jobKey(job));
    } catch {
      // This icon renders as a fallback tile until a later Refresh lands it.
    }
  };

  for (let start = 0; start < pending.length; start += DOWNLOAD_CONCURRENCY) {
    await Promise.all(pending.slice(start, start + DOWNLOAD_CONCURRENCY).map(download));
  }
  return available;
}

// Stamps local icon URLs onto the payload for exactly the icons that exist on
// disk. The payload never references a file that is not there, so an absent
// icon field is the UI's one signal to render the fallback tile.
export function applyIconRefs(setData: SetDataResponse, available: Set<string>): void {
  const stamp = (kind: IconJob["kind"], entry: { apiName: string; icon?: string }) => {
    if (available.has(`${kind}/${entry.apiName}`)) {
      entry.icon = `/icons/${kind}/${entry.apiName}.png`;
    }
  };
  for (const unit of setData.units) stamp("units", unit);
  for (const trait of setData.traits) stamp("traits", trait);
  for (const item of setData.items) stamp("items", item);
  for (const component of setData.components ?? []) stamp("components", component);
}
