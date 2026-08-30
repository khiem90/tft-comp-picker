import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/server/app";
import type { SourceFetcher, SourcePayloads } from "../src/server/sources";
import type { PatchChange, RankedComp } from "../src/shared/types";

const recordedDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "recorded",
);

const NOW = Date.parse("2026-08-30T12:00:00Z");
const now = () => NOW;

function loadRecorded(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(recordedDir, name), "utf8"));
}

// Fresh copies on every call, so a test can mutate its "after" payload
// without touching its "before".
function recordedPayloads(): SourcePayloads {
  return {
    patch: loadRecorded("metatft-patch.json"),
    compsData: loadRecorded("metatft-comps_data.json"),
    cdragon: loadRecorded("cdragon-set18.json"),
  };
}

// The mutable corners of the recorded MetaTFT payloads that these tests
// reshape into "after" states.
interface MutableCluster {
  overall: { avg: number };
  name: Array<{ name: string; type: string }>;
}

function clusters(payloads: SourcePayloads): Record<string, MutableCluster> {
  return (
    payloads.compsData as {
      results: { data: { cluster_details: Record<string, MutableCluster> } };
    }
  ).results.data.cluster_details;
}

function setPatch(payloads: SourcePayloads, patch: string): void {
  (payloads.patch as { patch: string }).patch = patch;
}

// Answers payloads in order, one per fetchSources call; the last one repeats.
function sequencedFetcher(...sequence: SourcePayloads[]): SourceFetcher {
  let call = 0;
  return {
    async fetchSources() {
      const payloads = sequence[Math.min(call, sequence.length - 1)];
      call += 1;
      return payloads;
    },
  };
}

const tempDirs: string[] = [];

function emptyDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tft-staleness-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function compIds(body: { comps: RankedComp[] }): string[] {
  return body.comps.map((comp) => comp.id);
}

describe("Staleness: Patch change", () => {
  it("re-pulls Comps and Set data and flags what moved", async () => {
    const before = recordedPayloads();
    const after = recordedPayloads();
    setPatch(after, "18.2");
    // Fae Rengar (422000) drops off the source, Defender Cassiopeia (422003)
    // falls S to C, and a new Executioner Caitlyn cluster appears.
    delete clusters(after)["422000"];
    clusters(after)["422003"].overall.avg = 5.2;
    const added = JSON.parse(JSON.stringify(clusters(after)["422001"])) as MutableCluster;
    added.name[1].name = "DA_18_Caitlyn";
    clusters(after)["999999"] = added;

    const app = createApp({
      dataDir: emptyDataDir(),
      fetcher: sequencedFetcher(before, after),
      now,
    });
    await request(app).get("/api/comps");
    const refresh = await request(app).post("/api/refresh");
    expect(refresh.status).toBe(200);

    const comps = await request(app).get("/api/comps");
    expect(comps.body.patch).toBe("18.2");
    const change: PatchChange = comps.body.patchChange;
    expect(change.fromPatch).toBe("18.1");
    expect(change.toPatch).toBe("18.2");
    expect(change.addedComps).toContain("Executioner Caitlyn");
    expect(change.removedComps).toContain("Fae Rengar");
    expect(change.tierMoves).toContainEqual({
      name: "Defender Cassiopeia",
      from: "S",
      to: "C",
    });

    // Set data came along in the same Refresh, not just Comps.
    const setData = await request(app).get("/api/set-data");
    expect(setData.body.patch).toBe("18.2");
  });

  it("clears the flag on the next Refresh inside the same Patch", async () => {
    const before = recordedPayloads();
    const after = recordedPayloads();
    setPatch(after, "18.2");

    const app = createApp({
      dataDir: emptyDataDir(),
      fetcher: sequencedFetcher(before, after),
      now,
    });
    await request(app).get("/api/comps");
    await request(app).post("/api/refresh");
    const flagged = await request(app).get("/api/comps");
    expect(flagged.body.patchChange).not.toBeNull();

    // The fetcher repeats its last payload: same Patch, so nothing moved.
    await request(app).post("/api/refresh");
    const settled = await request(app).get("/api/comps");
    expect(settled.body.patch).toBe("18.2");
    expect(settled.body.patchChange).toBeNull();
  });

  it("does not flag a first Refresh into an empty data dir", async () => {
    const app = createApp({
      dataDir: emptyDataDir(),
      fetcher: sequencedFetcher(recordedPayloads()),
      now,
    });

    const comps = await request(app).get("/api/comps");

    expect(comps.body.patch).toBe("18.1");
    expect(comps.body.patchChange).toBeNull();
  });
});

describe("Staleness: Comp removal", () => {
  it("drops a Comp that is absent from the fresh source payload", async () => {
    const before = recordedPayloads();
    const after = recordedPayloads();
    delete clusters(after)["422000"];

    const app = createApp({
      dataDir: emptyDataDir(),
      fetcher: sequencedFetcher(before, after),
      now,
    });
    const first = await request(app).get("/api/comps");
    expect(compIds(first.body)).toContain("422000");
    expect(first.body.comps.length).toBe(53);

    await request(app).post("/api/refresh");

    const second = await request(app).get("/api/comps");
    expect(compIds(second.body)).not.toContain("422000");
    expect(second.body.comps.length).toBe(52);
    // Same Patch, so the removal happens silently: no change flag.
    expect(second.body.patchChange).toBeNull();
  });
});

describe("Staleness: Tier fall", () => {
  const faeRengarBoard = [
    "Kobuko",
    "Lillia",
    "Rakan",
    "Rammus",
    "Rengar",
    "Tristana",
    "Vi",
  ];

  it("keeps a Comp whose Tier fell and ranks it down", async () => {
    const before = recordedPayloads();
    const after = recordedPayloads();
    // 4.29 average sat in the S bucket; 5.2 lands in C.
    clusters(after)["422000"].overall.avg = 5.2;

    const app = createApp({
      dataDir: emptyDataDir(),
      fetcher: sequencedFetcher(before, after),
      now,
    });
    const first = await request(app).get("/api/comps");
    const rankBefore = compIds(first.body).indexOf("422000");

    await request(app).post("/api/refresh");

    const second = await request(app).get("/api/comps");
    const faeRengar = second.body.comps.find(
      (comp: RankedComp) => comp.id === "422000",
    );
    expect(faeRengar).toBeDefined();
    expect(faeRengar.tier).toBe("C");
    expect(second.body.comps.length).toBe(53);
    const rankAfter = compIds(second.body).indexOf("422000");
    expect(rankAfter).toBeGreaterThan(rankBefore);
  });

  it("still ranks a fallen Comp high when the player's Holdings fit it", async () => {
    const after = recordedPayloads();
    clusters(after)["422000"].overall.avg = 5.2;

    const app = createApp({
      dataDir: emptyDataDir(),
      fetcher: sequencedFetcher(after),
      now,
    });

    const response = await request(app)
      .get("/api/comps")
      .query({ units: faeRengarBoard });

    // Strong Fit beats Tier: with the full board held, the fallen C Comp
    // sits in the top four of 53, and every Comp above it holds at least two
    // of these units itself. No Comp the player is uninvested in outranks it.
    const order = compIds(response.body);
    const rank = order.indexOf("422000");
    expect(rank).toBeLessThanOrEqual(3);
    for (const comp of response.body.comps.slice(0, rank) as RankedComp[]) {
      expect(comp.fit.heldUnits.length).toBeGreaterThanOrEqual(2);
    }
  });
});
