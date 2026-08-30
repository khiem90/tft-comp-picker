import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/server/app";
import type { SourceFetcher, SourcePayloads } from "../src/server/sources";
import type { RankedComp } from "../src/shared/types";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const recordedDir = path.join(fixturesDir, "recorded");

// A fixed clock: 2026-08-30 noon UTC. Staleness in these tests is always
// relative to this instant, never to the machine's clock.
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

interface CountingFetcher extends SourceFetcher {
  calls: number;
}

function fakeFetcher(payloads: SourcePayloads = recordedPayloads()): CountingFetcher {
  return {
    calls: 0,
    async fetchSources() {
      this.calls += 1;
      return payloads;
    },
  };
}

function failingFetcher(message = "MetaTFT unreachable"): CountingFetcher {
  return {
    calls: 0,
    async fetchSources() {
      this.calls += 1;
      throw new Error(message);
    },
  };
}

const tempDirs: string[] = [];

function emptyDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tft-refresh-"));
  tempDirs.push(dir);
  return dir;
}

// Seeds the hand-curated fixture data (patch 16.1) with a chosen age.
function seededDataDir(ageMs: number): string {
  const dir = emptyDataDir();
  const comps = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, "comps.json"), "utf8"),
  ) as { refreshedAt: string };
  comps.refreshedAt = new Date(NOW - ageMs).toISOString();
  fs.writeFileSync(path.join(dir, "comps.json"), JSON.stringify(comps));
  fs.copyFileSync(
    path.join(fixturesDir, "set-data.json"),
    path.join(dir, "set-data.json"),
  );
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("Refresh self-population", () => {
  it("fetches sources and self-populates when no data files exist", async () => {
    const dataDir = emptyDataDir();
    const fetcher = fakeFetcher();
    const app = createApp({ dataDir, fetcher, now });

    const response = await request(app).get("/api/comps");

    expect(response.status).toBe(200);
    expect(response.body.patch).toBe("18.1");
    expect(response.body.refreshedAt).toBe("2026-08-30T12:00:00.000Z");
    expect(response.body.refreshError).toBeNull();
    expect(fetcher.calls).toBe(1);
    expect(fs.existsSync(path.join(dataDir, "comps.json"))).toBe(true);
    expect(fs.existsSync(path.join(dataDir, "set-data.json"))).toBe(true);
  });

  it("transforms MetaTFT clusters into Comps with display names from Set data", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    const comps: RankedComp[] = response.body.comps;
    expect(comps.length).toBe(53);
    const faeRengar = comps.find((comp) => comp.id === "422000")!;
    expect(faeRengar.name).toBe("Fae Rengar");
    expect(faeRengar.board.map((slot) => slot.unit)).toEqual([
      "Kobuko",
      "Lillia",
      "Rakan",
      "Rammus",
      "Rengar",
      "Tristana",
      "Vi",
    ]);
    const rengar = faeRengar.board.find((slot) => slot.unit === "Rengar")!;
    expect(rengar.cost).toBe(3);
    expect(rengar.items).toEqual(["Fae Emblem", "Sprykin Emblem", "Titan's Resolve"]);
    // The item pool merges top_itemNames with the carries' best-in-slot
    // builds (recon gap 3), so a held build item earns Fit credit even when
    // it misses the cluster-wide top list.
    expect(faeRengar.itemPriorities).toEqual([
      "Guinsoo's Rageblade",
      "Gargoyle Stoneplate",
      "Fae Emblem",
      "Spirit Visage",
      "Edge of Night",
      "Sprykin Emblem",
      "Titan's Resolve",
      "Deathblade",
      "Hextech Gunblade",
      "Warmogs Armor",
      "Evenshroud",
      "Sunfire Cape",
    ]);
  });

  it("derives a Tier for every Comp by bucketing average placement", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    const comps: RankedComp[] = response.body.comps;
    for (const comp of comps) {
      expect(["S", "A", "B", "C", "D"]).toContain(comp.tier);
    }
    const tiers = new Set(comps.map((comp) => comp.tier));
    expect(tiers.has("S")).toBe(true);
    expect(tiers.has("D")).toBe(true);
    // Cluster 422000 averages 4.29, comfortably in the S bucket.
    expect(comps.find((comp) => comp.id === "422000")!.tier).toBe("S");
  });

  it("self-populates Set data for the pickers", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/set-data");

    expect(response.status).toBe(200);
    expect(response.body.patch).toBe("18.1");
    expect(response.body.setNumber).toBe(18);
    const unitNames = response.body.units.map((unit: { name: string }) => unit.name);
    expect(unitNames).toContain("Rengar");
    expect(unitNames.length).toBe(74);
    const guinsoos = response.body.items.find(
      (item: { name: string }) => item.name === "Guinsoo's Rageblade",
    );
    expect(guinsoos.components).toEqual(["Recurve Bow", "Needlessly Large Rod"]);
    const augmentNames = response.body.augments.map(
      (augment: { name: string }) => augment.name,
    );
    expect(augmentNames).toContain("Focused Fire");
  });

  it("runs a single Refresh for concurrent first requests", async () => {
    const fetcher = fakeFetcher();
    const app = createApp({ dataDir: emptyDataDir(), fetcher, now });

    const [first, second] = await Promise.all([
      request(app).get("/api/comps"),
      request(app).get("/api/comps"),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(fetcher.calls).toBe(1);
  });
});

describe("Refresh staleness trigger", () => {
  it("Refreshes before serving when data is older than 24 hours", async () => {
    const fetcher = fakeFetcher();
    const app = createApp({ dataDir: seededDataDir(25 * HOUR), fetcher, now });

    const response = await request(app).get("/api/comps");

    expect(response.status).toBe(200);
    expect(fetcher.calls).toBe(1);
    expect(response.body.patch).toBe("18.1");
    expect(response.body.refreshedAt).toBe("2026-08-30T12:00:00.000Z");
  });

  it("does not fetch when data is fresh", async () => {
    const fetcher = fakeFetcher();
    const app = createApp({ dataDir: seededDataDir(1 * HOUR), fetcher, now });

    const response = await request(app).get("/api/comps");

    expect(response.status).toBe(200);
    expect(fetcher.calls).toBe(0);
    expect(response.body.patch).toBe("16.1");
  });
});

describe("Manual Refresh", () => {
  it("re-fetches on demand even when data is fresh", async () => {
    const fetcher = fakeFetcher();
    const dataDir = seededDataDir(1 * HOUR);
    const app = createApp({ dataDir, fetcher, now });

    const refresh = await request(app).post("/api/refresh");

    expect(refresh.status).toBe(200);
    expect(refresh.body.patch).toBe("18.1");
    expect(refresh.body.refreshedAt).toBe("2026-08-30T12:00:00.000Z");
    expect(fetcher.calls).toBe(1);

    const comps = await request(app).get("/api/comps");
    expect(comps.body.patch).toBe("18.1");
  });

  it("reports failure and keeps last good data when the fetcher fails", async () => {
    const app = createApp({
      dataDir: seededDataDir(1 * HOUR),
      fetcher: failingFetcher(),
      now,
    });

    const refresh = await request(app).post("/api/refresh");

    expect(refresh.status).toBe(502);
    expect(refresh.body.error).toContain("MetaTFT unreachable");

    const comps = await request(app).get("/api/comps");
    expect(comps.status).toBe(200);
    expect(comps.body.patch).toBe("16.1");
    expect(comps.body.refreshError).toContain("MetaTFT unreachable");
  });
});

describe("Degraded mode", () => {
  it("serves last good data and surfaces the failure when a stale-triggered Refresh fails", async () => {
    const fetcher = failingFetcher();
    const app = createApp({ dataDir: seededDataDir(25 * HOUR), fetcher, now });

    const response = await request(app).get("/api/comps");

    expect(response.status).toBe(200);
    expect(fetcher.calls).toBe(1);
    expect(response.body.patch).toBe("16.1");
    expect(response.body.refreshError).toContain("MetaTFT unreachable");
    expect(response.body.comps.length).toBeGreaterThan(0);
  });

  it("answers 503 when there is no data at all and the fetcher fails", async () => {
    const app = createApp({
      dataDir: emptyDataDir(),
      fetcher: failingFetcher(),
      now,
    });

    const response = await request(app).get("/api/comps");

    expect(response.status).toBe(503);
    expect(response.body.error).toContain("MetaTFT unreachable");
  });

  it("clears the surfaced failure once a later Refresh succeeds", async () => {
    const dataDir = seededDataDir(25 * HOUR);
    const broken = createApp({ dataDir, fetcher: failingFetcher(), now });
    await request(broken).get("/api/comps");

    const recovered = createApp({ dataDir, fetcher: fakeFetcher(), now });
    const response = await request(recovered).get("/api/comps");

    expect(response.body.patch).toBe("18.1");
    expect(response.body.refreshError).toBeNull();
  });
});

describe("Augment mapping", () => {
  it("maps non-empty top_augments onto Comp augments so augment Fit turns on", async () => {
    const payloads = recordedPayloads();
    const compsData = payloads.compsData as {
      results: {
        data: { cluster_details: Record<string, { top_augments: unknown[] }> };
      };
    };
    // The live field is empty on every cluster today; simulate the day MetaTFT
    // populates it. Shape mirrors top_itemNames (objects keyed itemNames), and
    // plain id strings are accepted too.
    compsData.results.data.cluster_details["422000"].top_augments = [
      { itemNames: "DA_FocusedFire", count: 500, avg: 4.01 },
      "DA_18_RiftbeastTraitAugment",
    ];
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(payloads), now });

    const response = await request(app)
      .get("/api/comps")
      .query({ augments: ["Focused Fire"] });

    const faeRengar = response.body.comps.find(
      (comp: { id: string }) => comp.id === "422000",
    )!;
    expect(faeRengar.augments).toEqual(["Focused Fire", "Omega Riftbeast"]);
    expect(faeRengar.fit.matchedAugments).toEqual(["Focused Fire"]);
  });

  it("leaves Comp augments absent while the source publishes none", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    for (const comp of response.body.comps as RankedComp[]) {
      expect(comp.augments).toBeUndefined();
    }
  });
});
