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
