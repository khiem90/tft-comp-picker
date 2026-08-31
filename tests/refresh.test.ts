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

  it("Refreshes when set-data.json is missing beside fresh comps.json", async () => {
    const fetcher = fakeFetcher();
    const dataDir = seededDataDir(1 * HOUR);
    fs.rmSync(path.join(dataDir, "set-data.json"));
    const app = createApp({ dataDir, fetcher, now });

    const response = await request(app).get("/api/set-data");

    expect(response.status).toBe(200);
    expect(fetcher.calls).toBe(1);
    expect(response.body.patch).toBe("18.1");
  });

  it("Refreshes when set-data.json is corrupt beside fresh comps.json", async () => {
    const fetcher = fakeFetcher();
    const dataDir = seededDataDir(1 * HOUR);
    fs.writeFileSync(path.join(dataDir, "set-data.json"), "{ not json");
    const app = createApp({ dataDir, fetcher, now });

    const response = await request(app).get("/api/comps");

    expect(response.status).toBe(200);
    expect(fetcher.calls).toBe(1);
    expect(response.body.patch).toBe("18.1");
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

describe("apiName preservation", () => {
  // The join key later slices need: icon paths and MetaTFT trait strings both
  // speak apiName, and 756 Community Dragon items share only 566 display
  // names, so a name join is ambiguous where an apiName join is not.
  interface NamedApi {
    name: string;
    apiName: string;
  }

  it("carries apiName on every Set data unit, item, and trait", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/set-data");

    const units: Array<NamedApi & { traits: string[] }> = response.body.units;
    for (const unit of units) expect(unit.apiName).toBeTruthy();
    expect(units.find((unit) => unit.name === "Rengar")!.apiName).toBe("DA_18_Rengar");

    const items: Array<NamedApi & { components: string[]; componentApiNames: string[] }> =
      response.body.items;
    for (const item of items) {
      expect(item.apiName).toBeTruthy();
      expect(item.componentApiNames.length).toBe(item.components.length);
    }
    const guinsoos = items.find((item) => item.name === "Guinsoo's Rageblade")!;
    expect(guinsoos.apiName).toBe("DA_GuinsoosRageblade");
    expect(guinsoos.componentApiNames).toEqual([
      "DA_Component_RecurveBow",
      "DA_Component_NeedlesslyLargeRod",
    ]);

    const traits: NamedApi[] = response.body.traits;
    expect(traits.length).toBeGreaterThan(0);
    for (const trait of traits) {
      expect(trait.name).toBeTruthy();
      expect(trait.apiName).toBeTruthy();
    }
    expect(traits.find((trait) => trait.name === "Fae")!.apiName).toBe("DA_18_Fae");
  });

  it("joins traits by apiName (MetaTFT side) and display name (champion side)", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/set-data");

    const traits: NamedApi[] = response.body.traits;
    const byApi = new Map(traits.map((trait) => [trait.apiName, trait.name]));
    // MetaTFT's traits_string for cluster 422000 references DA_18_Sprykin.
    expect(byApi.get("DA_18_Sprykin")).toBe("Sprykin");
    // Champion trait lists speak display names; every one must resolve.
    const byName = new Set(traits.map((trait) => trait.name));
    const units: Array<{ traits: string[] }> = response.body.units;
    for (const unit of units) {
      for (const traitName of unit.traits) expect(byName.has(traitName)).toBe(true);
    }
  });

  it("carries apiName on board slots and their item references", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    const comps: RankedComp[] = response.body.comps;
    for (const comp of comps) {
      for (const slot of comp.board) {
        expect(slot.apiName).toBeTruthy();
        expect(slot.itemApiNames.length).toBe(slot.items.length);
      }
    }
    const faeRengar = comps.find((comp) => comp.id === "422000")!;
    const rengar = faeRengar.board.find((slot) => slot.unit === "Rengar")!;
    expect(rengar.apiName).toBe("DA_18_Rengar");
    expect(rengar.items).toEqual(["Fae Emblem", "Sprykin Emblem", "Titan's Resolve"]);
    expect(rengar.itemApiNames).toEqual([
      "DA_18_EmblemFae",
      "DA_18_EmblemSprykin",
      "DA_TitansResolve",
    ]);
  });

  it("aligns itemPriorityApiNames with itemPriorities on every Comp", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    // The recorded Community Dragon payload is the ground truth for the join.
    const cdragon = loadRecorded("cdragon-set18.json") as {
      items: Array<{ apiName: string; name: string }>;
    };
    const itemNames = new Map(cdragon.items.map((item) => [item.apiName, item.name]));
    const comps: RankedComp[] = response.body.comps;
    for (const comp of comps) {
      expect(comp.itemPriorityApiNames.length).toBe(comp.itemPriorities.length);
      comp.itemPriorityApiNames.forEach((api, index) => {
        expect(itemNames.get(api)).toBe(comp.itemPriorities[index]);
      });
    }
    const faeRengar = comps.find((comp) => comp.id === "422000")!;
    expect(faeRengar.itemPriorityApiNames.slice(0, 3)).toEqual([
      "DA_GuinsoosRageblade",
      "DA_GargoyleStoneplate",
      "DA_18_EmblemFae",
    ]);
  });
});

describe("Comp card data", () => {
  it("decodes trait breakpoints from traits_string, including emblem contributions", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    const faeRengar = (response.body.comps as RankedComp[]).find(
      (comp) => comp.id === "422000",
    )!;
    // The board holds three Fae units (Lillia, Rakan, Tristana); the fourth
    // comes from Rengar's Fae Emblem. Only traits_string sees it: a tally of
    // the unit list would say 3.
    expect(faeRengar.traits).toEqual([
      { name: "Fae", apiName: "DA_18_Fae", count: 4 },
      { name: "Sprykin", apiName: "DA_18_Sprykin", count: 3 },
      { name: "Defender", apiName: "DA_18_Defender", count: 2 },
      { name: "Juggernaut", apiName: "DA_Juggernaut18", count: 2 },
      { name: "Rival", apiName: "DA_18_Rival", count: 1 },
    ]);
  });

  it("drops a trait whose breakpoint ladder carries no count instead of inventing one", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    // Cluster 422038's traits_string includes DA_18_Eclipse_1, but Eclipse's
    // one recorded breakpoint has minUnits: null. No honest count exists, so
    // the chip is dropped rather than faked.
    const eclipseComp = (response.body.comps as RankedComp[]).find(
      (comp) => comp.id === "422038",
    )!;
    expect(eclipseComp.traits!.length).toBeGreaterThan(0);
    expect(eclipseComp.traits!.map((trait) => trait.apiName)).not.toContain(
      "DA_18_Eclipse",
    );
  });

  it("decodes every cluster's traits against Set data breakpoints", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const [comps, setData] = await Promise.all([
      request(app).get("/api/comps"),
      request(app).get("/api/set-data"),
    ]);

    const traitApis = new Set(
      (setData.body.traits as Array<{ apiName: string }>).map((t) => t.apiName),
    );
    for (const comp of comps.body.comps as RankedComp[]) {
      expect(comp.traits!.length).toBeGreaterThan(0);
      for (const trait of comp.traits!) {
        expect(traitApis.has(trait.apiName)).toBe(true);
        expect(trait.count).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("passes the levelling enum through as Playstyle", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    const comps: RankedComp[] = response.body.comps;
    expect(comps.find((comp) => comp.id === "422000")!.playstyle).toBe("lvl 7");
    const playstyles = new Set(comps.map((comp) => comp.playstyle));
    expect([...playstyles].sort()).toEqual([
      "Fast 8",
      "Fast 9",
      "Standard",
      "lvl 5",
      "lvl 6",
      "lvl 7",
    ]);
  });

  it("scores a full-match Holdings set at 100 and ranks it first", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const empty = await request(app).get("/api/comps");
    const faeRengar = (empty.body.comps as RankedComp[]).find(
      (comp) => comp.id === "422000",
    )!;
    const fullMatch = await request(app).get("/api/comps").query({
      units: faeRengar.board.map((slot) => slot.unit),
      items: faeRengar.itemPriorities,
    });

    const held = (fullMatch.body.comps as RankedComp[]).find(
      (comp) => comp.id === "422000",
    )!;
    expect(held.fit.score).toBe(100);
    expect(fullMatch.body.comps[0].id).toBe("422000");
  });
});

describe("Core Units and Star targets", () => {
  it("marks the builds units as Core Units, in builds order, with items on their slots", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    const faeRengar = (response.body.comps as RankedComp[]).find(
      (comp) => comp.id === "422000",
    )!;
    expect(faeRengar.coreUnits).toEqual([
      "DA_18_Rengar",
      "DA_18_Tristana",
      "DA_18_Rammus",
      "DA_Vi18",
    ]);
    // The build items themselves ride on the matching board slots; every
    // Core Unit must have a slot that carries its build.
    for (const api of faeRengar.coreUnits!) {
      const slot = faeRengar.board.find((candidate) => candidate.apiName === api)!;
      expect(slot.items.length).toBeGreaterThan(0);
    }
  });

  it("drops a builds unit that is not on the Comp's own board", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    // Cluster 422006's builds list DA_18_Hecarim, a headliner variant that
    // never appears in its units_string; only the three on-board units stay.
    const comp = (response.body.comps as RankedComp[]).find(
      (comp) => comp.id === "422006",
    )!;
    expect(comp.coreUnits).toEqual(["DA_18_Aphelios", "DA_18_Lillia", "DA_18_Alune"]);
  });

  it("intersects the source's star list with the board before serving it", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    // 422000's raw stars list eight units; four (Hecarim, Kha'Zix, Kog'Maw,
    // Cassiopeia) are strays from cluster classification and must not appear.
    const faeRengar = (response.body.comps as RankedComp[]).find(
      (comp) => comp.id === "422000",
    )!;
    expect(faeRengar.starTargets).toEqual([
      "DA_18_Rengar",
      "DA_18_Tristana",
      "DA_18_Rammus",
      "DA_Vi18",
    ]);
  });

  it("serves an empty star list when every source star is a stray", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    // 422001's only raw star (DA_18_KhaZix) is not on its board.
    const comp = (response.body.comps as RankedComp[]).find(
      (comp) => comp.id === "422001",
    )!;
    expect(comp.starTargets).toEqual([]);
  });

  it("keeps Core Units and Star targets inside every Comp's board", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    for (const comp of response.body.comps as RankedComp[]) {
      const boardApis = new Set(comp.board.map((slot) => slot.apiName));
      expect(comp.coreUnits!.length).toBeGreaterThan(0);
      // The source marks four builds per cluster; filtering can only shrink.
      expect(comp.coreUnits!.length).toBeLessThanOrEqual(4);
      for (const api of comp.coreUnits!) expect(boardApis.has(api)).toBe(true);
      for (const api of comp.starTargets!) expect(boardApis.has(api)).toBe(true);
    }
  });
});

describe("Board layout", () => {
  it("gives every board unit a hex position inside the 4x7 grid", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    for (const comp of response.body.comps as RankedComp[]) {
      for (const slot of comp.board) {
        expect(slot.position).toBeDefined();
        expect(slot.position!.row).toBeGreaterThanOrEqual(0);
        expect(slot.position!.row).toBeLessThanOrEqual(3);
        expect(slot.position!.col).toBeGreaterThanOrEqual(0);
        expect(slot.position!.col).toBeLessThanOrEqual(6);
      }
    }
  });

  it("never places two units of a Comp on the same hex", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    for (const comp of response.body.comps as RankedComp[]) {
      const hexes = comp.board.map(
        (slot) => `${slot.position!.row},${slot.position!.col}`,
      );
      expect(new Set(hexes).size).toBe(hexes.length);
    }
  });

  it("puts tank roles on the front rows and caster roles on the back rows", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    const comps = response.body.comps as RankedComp[];
    // Kobuko is the recorded payload's one role-carrying frontliner (APTank);
    // Alune its one role-carrying backliner (APCaster).
    const faeRengar = comps.find((comp) => comp.id === "422000")!;
    const kobuko = faeRengar.board.find((slot) => slot.apiName === "DA_18_Kobuko")!;
    expect(kobuko.position!.row).toBeLessThanOrEqual(1);
    const lunarComp = comps.find((comp) => comp.id === "422006")!;
    const alune = lunarComp.board.find((slot) => slot.apiName === "DA_18_Alune")!;
    expect(alune.position!.row).toBeGreaterThanOrEqual(2);
  });

  it("lets a role override the range fallback in both directions", async () => {
    // Both role-carrying units in the recorded payload (Kobuko, Alune) sit
    // where their range alone would put them, so only a synthetic conflict
    // proves role wins: a ranged tank must still front, a melee caster back.
    const payloads = recordedPayloads();
    const cdragon = payloads.cdragon as {
      sets: Record<string, { champions: Array<{ apiName: string; role?: string | null }> }>;
    };
    const champions = cdragon.sets["18"].champions;
    champions.find((champ) => champ.apiName === "DA_18_Tristana")!.role = "ADTank";
    champions.find((champ) => champ.apiName === "DA_18_Rengar")!.role = "ADCaster";
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(payloads), now });

    const response = await request(app).get("/api/comps");

    const faeRengar = (response.body.comps as RankedComp[]).find(
      (comp) => comp.id === "422000",
    )!;
    const rowOf = (api: string): number =>
      faeRengar.board.find((slot) => slot.apiName === api)!.position!.row;
    expect(rowOf("DA_18_Tristana")).toBeLessThanOrEqual(1);
    expect(rowOf("DA_18_Rengar")).toBeGreaterThanOrEqual(2);
  });

  it("falls back to attack range where the role is null: melee front, ranged back", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    // role is null on 72 of the 74 recorded units (verified live too), so the
    // range fallback carries nearly the whole layout. 422000's melee units
    // must land in the front rows and its one ranged unit in the back rows.
    const faeRengar = (response.body.comps as RankedComp[]).find(
      (comp) => comp.id === "422000",
    )!;
    const rowOf = (api: string): number =>
      faeRengar.board.find((slot) => slot.apiName === api)!.position!.row;
    for (const melee of ["DA_18_Lillia", "DA_18_Rakan", "DA_18_Rammus", "DA_18_Rengar", "DA_Vi18"]) {
      expect(rowOf(melee)).toBeLessThanOrEqual(1);
    }
    expect(rowOf("DA_18_Tristana")).toBeGreaterThanOrEqual(2);
  });

  it("fills each line from the center of its outermost row, in board order", async () => {
    const app = createApp({ dataDir: emptyDataDir(), fetcher: fakeFetcher(), now });

    const response = await request(app).get("/api/comps");

    // 422000 fields six frontliners and one backliner: the front six walk the
    // front row center-out in board order, the lone ranged unit anchors the
    // back row's center.
    const faeRengar = (response.body.comps as RankedComp[]).find(
      (comp) => comp.id === "422000",
    )!;
    const positions = new Map(
      faeRengar.board.map((slot) => [slot.apiName, slot.position!]),
    );
    expect(positions.get("DA_18_Kobuko")).toEqual({ row: 0, col: 3 });
    expect(positions.get("DA_18_Lillia")).toEqual({ row: 0, col: 2 });
    expect(positions.get("DA_18_Rakan")).toEqual({ row: 0, col: 4 });
    expect(positions.get("DA_18_Rammus")).toEqual({ row: 0, col: 1 });
    expect(positions.get("DA_18_Rengar")).toEqual({ row: 0, col: 5 });
    expect(positions.get("DA_Vi18")).toEqual({ row: 0, col: 0 });
    expect(positions.get("DA_18_Tristana")).toEqual({ row: 3, col: 3 });
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
