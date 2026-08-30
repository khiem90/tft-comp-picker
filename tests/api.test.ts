import { fileURLToPath } from "node:url";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("GET /api/comps", () => {
  it("returns every Comp ranked in Tier order when the player holds nothing", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const response = await request(app).get("/api/comps");

    expect(response.status).toBe(200);
    expect(response.body.patch).toBe("16.1");
    expect(response.body.comps.map((comp: { id: string }) => comp.id)).toEqual([
      "faerie-spellweavers",
      "wildwood-snipers",
      "bruiser-brawlers",
    ]);
  });

  it("ranks a lower-Tier Comp with strong unit overlap above a top-Tier Comp with none", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const response = await request(app)
      .get("/api/comps")
      .query({ units: ["Grib", "Thornmaw"] });

    expect(response.status).toBe(200);
    expect(response.body.comps.map((comp: { id: string }) => comp.id)).toEqual([
      "bruiser-brawlers",
      "faerie-spellweavers",
      "wildwood-snipers",
    ]);
  });

  it("re-ranks between requests as Holdings change", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const before = await request(app).get("/api/comps");
    const after = await request(app)
      .get("/api/comps")
      .query({ units: ["Fenwick", "Kaelen"] });

    expect(before.body.comps[0].id).toBe("faerie-spellweavers");
    expect(after.body.comps[0].id).toBe("wildwood-snipers");
  });

  it("tells each Comp's Fit apart: held units, missing units, and a readable reason", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const response = await request(app).get("/api/comps").query({ units: ["Fenwick"] });

    const sniperComp = response.body.comps.find(
      (comp: { id: string }) => comp.id === "wildwood-snipers",
    );
    expect(sniperComp.fit).toEqual({
      score: 50,
      heldUnits: ["Fenwick"],
      missingUnits: ["Kaelen"],
      reason: "Holding 1 of 2 units",
    });
  });

  it("explains the Tier-order fallback when Holdings are empty", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const response = await request(app).get("/api/comps");

    const topComp = response.body.comps[0];
    expect(topComp.fit).toEqual({
      score: 0,
      heldUnits: [],
      missingUnits: ["Lilna", "Sylvara"],
      reason: "No Holdings yet, ranked by Tier",
    });
  });

  it("carries each Comp's final board and item priorities", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const response = await request(app).get("/api/comps");

    const sniperComp = response.body.comps.find(
      (comp: { id: string }) => comp.id === "wildwood-snipers",
    );
    expect(sniperComp.tier).toBe("A");
    expect(sniperComp.board).toEqual([
      { unit: "Fenwick", cost: 3, items: ["Guinsoo's Rageblade"] },
      { unit: "Kaelen", cost: 4, items: ["Infinity Edge", "Last Whisper"] },
    ]);
    expect(sniperComp.itemPriorities).toEqual([
      "Guinsoo's Rageblade",
      "Infinity Edge",
      "Last Whisper",
    ]);
  });
});

describe("GET /api/set-data", () => {
  it("serves the Set data catalog from disk", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const response = await request(app).get("/api/set-data");

    expect(response.status).toBe(200);
    expect(response.body.setNumber).toBe(18);
    expect(response.body.setName).toBe("Enchanted Wilds");
    expect(response.body.units.map((unit: { name: string }) => unit.name)).toContain(
      "Sylvara",
    );
  });
});
