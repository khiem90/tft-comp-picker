import type { SetDataResponse } from "../shared/types";
import type { SourceFetcher } from "./sources";
import type { Storage } from "./storage";

// One icon a Refresh should hold locally: which catalog it belongs to, the
// apiName that keys its stored file, and the game-relative .png path to
// fetch it from. kind doubles as the directory segment in the icon store.
export interface IconJob {
  kind: "units" | "traits" | "items" | "components";
  apiName: string;
  sourcePath: string;
}

function jobKey(job: IconJob): string {
  return `${job.kind}/${job.apiName}`;
}

// Keeps a burst of ~175 downloads polite to the mirror and bounded in memory,
// while still finishing in a few round-trip times.
const DOWNLOAD_CONCURRENCY = 8;

export interface DownloadIconsOptions {
  storage: Storage;
  jobs: IconJob[];
  fetcher: SourceFetcher;
  // True when this Refresh crossed a Patch boundary, or when the previous
  // Patch is unknowable. Icons are Set data, so either way every stored icon
  // is stale: the whole store is replaced.
  patchChanged: boolean;
}

// Brings the icon store in line with the jobs and reports which icons are
// actually stored afterwards, keyed kind/apiName, valued their payload URL.
// Icons already stored are kept without a fetch (icons only change across
// Patches); everything else downloads. A failed download only costs that
// icon: it stays absent, the Refresh goes on, and the next same-Patch
// Refresh retries it.
export async function downloadIcons({
  storage,
  jobs,
  fetcher,
  patchChanged,
}: DownloadIconsOptions): Promise<Map<string, string>> {
  if (patchChanged) await storage.clearIcons();
  const stored = patchChanged ? new Map<string, string>() : await storage.listIcons();

  const available = new Map<string, string>();
  const pending: IconJob[] = [];
  for (const job of jobs) {
    const url = stored.get(jobKey(job));
    if (url) {
      available.set(jobKey(job), url);
    } else {
      pending.push(job);
    }
  }
  if (!fetcher.fetchIcon || pending.length === 0) return available;

  const download = async (job: IconJob): Promise<void> => {
    try {
      const bytes = await fetcher.fetchIcon!(job.sourcePath);
      const url = await storage.writeIcon(job, bytes);
      available.set(jobKey(job), url);
    } catch {
      // This icon renders as a fallback tile until a later Refresh lands it.
    }
  };

  for (let start = 0; start < pending.length; start += DOWNLOAD_CONCURRENCY) {
    await Promise.all(pending.slice(start, start + DOWNLOAD_CONCURRENCY).map(download));
  }
  return available;
}

// Stamps icon URLs onto the payload for exactly the icons the store holds.
// The payload never references an icon that is not there, so an absent icon
// field is the UI's one signal to render the fallback tile.
export function applyIconRefs(
  setData: SetDataResponse,
  available: Map<string, string>,
): void {
  const stamp = (kind: IconJob["kind"], entry: { apiName: string; icon?: string }) => {
    const url = available.get(`${kind}/${entry.apiName}`);
    if (url) entry.icon = url;
  };
  for (const unit of setData.units) stamp("units", unit);
  for (const trait of setData.traits) stamp("traits", trait);
  for (const item of setData.items) stamp("items", item);
  for (const component of setData.components ?? []) stamp("components", component);
}
