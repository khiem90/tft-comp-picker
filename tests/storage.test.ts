import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app";
import type { SourceFetcher, SourcePayloads } from "../src/server/sources";
import type { IconKey, Storage } from "../src/server/storage";
import type { SetDataResponse } from "../src/shared/types";

// The app on a Storage that is not a local disk: what the Vercel deployment
// runs on. These tests pin the storage contract through the same HTTP seam
// as everything else, so the Blob implementation has a spec to meet without
// the suite ever talking to Blob itself.

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const recordedDir = path.join(fixturesDir, "recorded");

const NOW = Date.parse("2026-08-30T12:00:00Z");
const now = () => NOW;
const HOUR = 60 * 60 * 1000;

function loadRecorded(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(recordedDir, name), "utf8"));
}

function recordedPayloads(): SourcePayloads {
  return {
    patch: loadRecorded("metatft-patch.json"),
    compsData: loadRecorded("metatft-comps_data.json"),
    cdragon: loadRecorded("cdragon-set18.json"),
  };
}

function fakeFetcher(withIcons = false): SourceFetcher {
  return {
    async fetchSources() {
      return recordedPayloads();
    },
    ...(withIcons
      ? {
          async fetchIcon(sourcePath: string) {
            return new TextEncoder().encode(`png:${sourcePath}`);
          },
        }
      : {}),
  };
}

function failingFetcher(message = "MetaTFT unreachable"): SourceFetcher {
  return {
    async fetchSources() {
      throw new Error(message);
    },
  };
}

// An icon URL shape only a non-disk store produces: absolute, no /icons
// route behind it. The app must pass it through to the payload verbatim.
function memoryIconUrl(key: IconKey): string {
  return `https://blob.example/icons/${key.kind}/${key.apiName}.png`;
}

interface MemoryStorage extends Storage {
  documents: Map<string, unknown>;
}

function memoryStorage(): MemoryStorage {
  const documents = new Map<string, unknown>();
  const icons = new Set<string>();
  return {
    documents,
    async readJson<T>(name: string): Promise<T> {
      if (!documents.has(name)) throw new Error(`no document ${name}`);
      return documents.get(name) as T;
    },
    async writeJson(name: string, value: unknown): Promise<void> {
      // Serialize through JSON so the store never shares object identity
      // with the writer, like a real remote store.
      documents.set(name, JSON.parse(JSON.stringify(value)));
    },
    async listIcons(): Promise<Map<string, string>> {
      return new Map(
        [...icons].map((key) => {
          const [kind, apiName] = key.split("/");
          return [key, memoryIconUrl({ kind, apiName })];
        }),
      );
    },
    async writeIcon(key: IconKey, _bytes: Uint8Array): Promise<string> {
      icons.add(`${key.kind}/${key.apiName}`);
      return memoryIconUrl(key);
    },
    async clearIcons(): Promise<void> {
      icons.clear();
    },
  };
}

function seedStorage(storage: MemoryStorage, ageMs: number): void {
  const comps = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, "comps.json"), "utf8"),
  ) as { refreshedAt: string };
  comps.refreshedAt = new Date(NOW - ageMs).toISOString();
  storage.documents.set("comps.json", comps);
  storage.documents.set(
    "set-data.json",
    JSON.parse(fs.readFileSync(path.join(fixturesDir, "set-data.json"), "utf8")),
  );
}

describe("App on non-disk Storage", () => {
  it("self-populates into the storage and serves from it", async () => {
    const storage = memoryStorage();
    const app = createApp({ storage, fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    expect(response.status).toBe(200);
    expect(response.body.patch).toBe("18.1");
    expect(response.body.comps.length).toBe(53);
    expect(storage.documents.has("comps.json")).toBe(true);
    expect(storage.documents.has("set-data.json")).toBe(true);
  });

  it("stamps the storage's own icon URLs into the payload verbatim", async () => {
    const storage = memoryStorage();
    const app = createApp({ storage, fetcher: fakeFetcher(true), now });

    const response = await request(app).get("/api/set-data");

    expect(response.status).toBe(200);
    const setData = response.body as SetDataResponse;
    const rengar = setData.units.find((unit) => unit.name === "Rengar")!;
    expect(rengar.icon).toBe("https://blob.example/icons/units/DA_18_Rengar.png");
  });

  it("reports a Refresh failure to another app instance on the same storage", async () => {
    const storage = memoryStorage();
    seedStorage(storage, 25 * HOUR);
    const broken = createApp({ storage, fetcher: failingFetcher(), now });
    const degraded = await request(broken).get("/api/comps");
    expect(degraded.status).toBe(200);
    expect(degraded.body.refreshError).toContain("MetaTFT unreachable");

    // A different instance, fresh memory, no fetcher: only the persisted
    // refresh state can tell it the data is running in degraded mode.
    const other = createApp({ storage, now });
    const response = await request(other).get("/api/comps");

    expect(response.status).toBe(200);
    expect(response.body.patch).toBe("16.1");
    expect(response.body.refreshError).toContain("MetaTFT unreachable");
  });

  it("clears the persisted failure for every instance once a Refresh succeeds", async () => {
    const storage = memoryStorage();
    seedStorage(storage, 25 * HOUR);
    await request(createApp({ storage, fetcher: failingFetcher(), now })).get(
      "/api/comps",
    );

    const recovered = createApp({ storage, fetcher: fakeFetcher(), now });
    await request(recovered).get("/api/comps");
    const other = createApp({ storage, now });
    const response = await request(other).get("/api/comps");

    expect(response.body.patch).toBe("18.1");
    expect(response.body.refreshError).toBeNull();
  });

  it("refuses an app configured with both dataDir and storage, or neither", () => {
    expect(() => createApp({})).toThrow();
    expect(() =>
      createApp({ dataDir: fixturesDir, storage: memoryStorage() }),
    ).toThrow();
  });
});
