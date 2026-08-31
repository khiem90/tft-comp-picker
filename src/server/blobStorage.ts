import { del, list, put } from "@vercel/blob";
import type { IconKey, Storage } from "./storage";

// Storage on Vercel Blob, for the hosted deployment where the filesystem is
// read-only and per-instance. JSON documents live under data/, icons under
// icons/; both use fixed pathnames so a Refresh overwrites in place.
//
// Two consistency caveats, both bounded and both invisible in normal use:
// - Blob's CDN can serve an overwritten document's previous bytes for up to
//   a minute. Reads version every fetch with the blob's uploadedAt (checked
//   against the store, not the CDN), and an instance that just wrote a
//   document trusts its own copy for longer than that window.
// - refreshError semantics span instances through the persisted
//   refresh-state.json, exactly like the JSON data documents.

const DATA_PREFIX = "data/";
const ICONS_PREFIX = "icons/";

// How long a fetched document is served without re-checking uploadedAt.
const CHECK_TTL_MS = 15 * 1000;
// How long an instance's own write is authoritative: longer than the CDN's
// overwrite-propagation window, so we never read our write back stale.
const LOCAL_AUTHORITY_MS = 120 * 1000;

const LOCAL_VERSION = "local-write";

interface CacheEntry {
  value: unknown;
  version: string;
  checkedAt: number;
}

interface BlobMeta {
  url: string;
  uploadedAt: Date;
}

async function findBlob(pathname: string): Promise<BlobMeta> {
  const { blobs } = await list({ prefix: pathname, limit: 10 });
  const match = blobs.find((blob) => blob.pathname === pathname);
  if (!match) throw new Error(`No blob at ${pathname}`);
  return match;
}

export function createBlobStorage(): Storage {
  const cache = new Map<string, CacheEntry>();

  return {
    async readJson<T>(name: string): Promise<T> {
      const entry = cache.get(name);
      const nowMs = Date.now();
      if (entry) {
        const ttl =
          entry.version === LOCAL_VERSION ? LOCAL_AUTHORITY_MS : CHECK_TTL_MS;
        if (nowMs - entry.checkedAt < ttl) return entry.value as T;
      }
      const meta = await findBlob(`${DATA_PREFIX}${name}`);
      const version = meta.uploadedAt.toISOString();
      if (entry && entry.version === version) {
        entry.checkedAt = nowMs;
        return entry.value as T;
      }
      // The version rides the URL so a changed document can never be
      // answered from a CDN entry keyed to the previous version.
      const response = await fetch(
        `${meta.url}?v=${encodeURIComponent(version)}`,
      );
      if (!response.ok) {
        throw new Error(`Blob read of ${name} answered ${response.status}`);
      }
      const value = JSON.parse(await response.text()) as T;
      cache.set(name, { value, version, checkedAt: nowMs });
      return value;
    },

    // Blob writes are atomic on their own: the pathname points at the old
    // bytes until the new upload completes.
    async writeJson(name: string, value: unknown): Promise<void> {
      await put(`${DATA_PREFIX}${name}`, JSON.stringify(value, null, 2), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
      cache.set(name, {
        value,
        version: LOCAL_VERSION,
        checkedAt: Date.now(),
      });
    },

    async listIcons(): Promise<Map<string, string>> {
      const icons = new Map<string, string>();
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: ICONS_PREFIX, cursor });
        for (const blob of page.blobs) {
          const relative = blob.pathname.slice(ICONS_PREFIX.length);
          if (!relative.endsWith(".png")) continue;
          icons.set(relative.slice(0, -".png".length), blob.url);
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return icons;
    },

    async writeIcon(key: IconKey, bytes: Uint8Array): Promise<string> {
      const result = await put(
        `${ICONS_PREFIX}${key.kind}/${key.apiName}.png`,
        Buffer.from(bytes),
        {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "image/png",
          // A patch-crossing Refresh overwrites these pathnames, so browsers
          // may show the old Patch's icons for up to this long afterwards.
          cacheControlMaxAge: 300,
        },
      );
      return result.url;
    },

    async clearIcons(): Promise<void> {
      const icons = await this.listIcons();
      const urls = [...icons.values()];
      for (let start = 0; start < urls.length; start += 100) {
        await del(urls.slice(start, start + 100));
      }
    },
  };
}
