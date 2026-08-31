import fs from "node:fs";
import path from "node:path";

// Where a Refresh's output lives and where requests read it from. Disk for
// the local server; Vercel Blob when hosted, where the filesystem is
// read-only and gone after every invocation. The app never touches fs or
// blob APIs directly, so both environments run the same tested code path.
export interface IconKey {
  kind: string;
  apiName: string;
}

export interface Storage {
  // JSON documents by file name ("comps.json"). Throws when the document is
  // missing or unparsable; callers treat any throw as "no usable data".
  readJson<T>(name: string): Promise<T>;
  // Atomic per document: a crash mid-write must never corrupt the previous
  // version.
  writeJson(name: string, value: unknown): Promise<void>;
  // The icons currently held, keyed "kind/apiName", valued the URL the
  // payload should reference for that icon.
  listIcons(): Promise<Map<string, string>>;
  // Stores one icon's bytes and resolves to its payload URL.
  writeIcon(key: IconKey, bytes: Uint8Array): Promise<string>;
  clearIcons(): Promise<void>;
  // Set when icons are local files the app must serve itself at /icons;
  // absent when icon URLs resolve on their own (Blob's CDN).
  localIconsDir?: string;
}

function iconUrl(key: IconKey): string {
  return `/icons/${key.kind}/${key.apiName}.png`;
}

export function createDiskStorage(dataDir: string): Storage {
  const iconsDir = path.join(dataDir, "icons");
  const iconFile = (key: IconKey): string =>
    path.join(iconsDir, key.kind, `${key.apiName}.png`);

  return {
    localIconsDir: iconsDir,

    async readJson<T>(name: string): Promise<T> {
      return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8")) as T;
    },

    // Write-then-rename so a crash mid-Refresh can never leave a
    // half-written data file behind; the last good file survives untouched.
    async writeJson(name: string, value: unknown): Promise<void> {
      const target = path.join(dataDir, name);
      const temp = `${target}.tmp`;
      fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
      fs.renameSync(temp, target);
    },

    async listIcons(): Promise<Map<string, string>> {
      const icons = new Map<string, string>();
      let kinds: string[];
      try {
        kinds = fs.readdirSync(iconsDir);
      } catch {
        return icons;
      }
      for (const kind of kinds) {
        let files: string[];
        try {
          files = fs.readdirSync(path.join(iconsDir, kind));
        } catch {
          continue;
        }
        for (const file of files) {
          if (!file.endsWith(".png")) continue;
          const key = { kind, apiName: file.slice(0, -".png".length) };
          icons.set(`${key.kind}/${key.apiName}`, iconUrl(key));
        }
      }
      return icons;
    },

    async writeIcon(key: IconKey, bytes: Uint8Array): Promise<string> {
      const target = iconFile(key);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      // Write-then-rename, like the JSON documents: a crash mid-write must
      // never leave a torn PNG that the payload then points at.
      const temp = `${target}.tmp`;
      fs.writeFileSync(temp, bytes);
      fs.renameSync(temp, target);
      return iconUrl(key);
    },

    async clearIcons(): Promise<void> {
      fs.rmSync(iconsDir, { recursive: true, force: true });
    },
  };
}
