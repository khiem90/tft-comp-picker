import { fileURLToPath } from "node:url";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app";
import type { CompFit } from "../src/shared/types";

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
      score: 20,
      heldUnits: ["Fenwick"],
      missingUnits: ["Kaelen"],
      heldItems: [],
      partialItems: [],
      missingItems: ["Guinsoo's Rageblade", "Infinity Edge", "Last Whisper"],
      matchedAugments: [],
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
      heldItems: [],
      partialItems: [],
      missingItems: ["Jeweled Gauntlet", "Spear of Shojin", "Rabadon's Deathcap"],
      matchedAugments: [],
      reason: "No Holdings yet, ranked by Tier",
    });
  });

  it("raises a Comp's Fit when a held component builds into a best-in-slot item", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const without = await request(app).get("/api/comps");
    const withComponent = await request(app)
      .get("/api/comps")
      .query({ items: ["Recurve Bow"] });

    const findSnipers = (body: { comps: Array<{ id: string; fit: CompFit }> }) =>
      body.comps.find((comp) => comp.id === "wildwood-snipers")!;
    expect(findSnipers(without.body).fit.score).toBe(0);
    const fit = findSnipers(withComponent.body).fit;
    expect(fit.score).toBe(10);
    expect(fit.partialItems).toEqual(["Guinsoo's Rageblade"]);
    expect(fit.reason).toBe("Holding 0 of 2 units, components toward 1 of 3 items");
  });

  it("counts a held completed item fully and lists it as held", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const response = await request(app)
      .get("/api/comps")
      .query({ items: ["Warmog's Armor"] });

    const bruiserComp = response.body.comps.find(
      (comp: { id: string }) => comp.id === "bruiser-brawlers",
    );
    expect(bruiserComp.fit.score).toBe(20);
    expect(bruiserComp.fit.heldItems).toEqual(["Warmog's Armor"]);
    expect(bruiserComp.fit.missingItems).toEqual(["Sunfire Cape", "Gargoyle Stoneplate"]);
    expect(bruiserComp.fit.reason).toBe("Holding 0 of 2 units, 1 of 3 items");
  });

  it("spends a held component on one priority item, not every item sharing it", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const response = await request(app)
      .get("/api/comps")
      .query({ items: ["Sparring Gloves"] });

    const sniperComp = response.body.comps.find(
      (comp: { id: string }) => comp.id === "wildwood-snipers",
    );
    // Both Infinity Edge and Last Whisper build from Sparring Gloves; one glove
    // may only advance one of them.
    expect(sniperComp.fit.partialItems).toEqual(["Infinity Edge"]);
    expect(sniperComp.fit.missingItems).toEqual(["Guinsoo's Rageblade", "Last Whisper"]);
    expect(sniperComp.fit.score).toBe(10);
  });

  it("credits a fully buildable item before splitting its components across neighbours", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const response = await request(app)
      .get("/api/comps")
      .query({ items: ["Recurve Bow", "Sparring Gloves"] });

    const sniperComp = response.body.comps.find(
      (comp: { id: string }) => comp.id === "wildwood-snipers",
    );
    // Bow + Gloves is a complete Last Whisper; it must not be spent as half a
    // Guinsoo's Rageblade plus half an Infinity Edge.
    expect(sniperComp.fit.partialItems).toEqual(["Last Whisper"]);
    expect(sniperComp.fit.missingItems).toEqual(["Guinsoo's Rageblade", "Infinity Edge"]);
    expect(sniperComp.fit.score).toBe(20);
  });

  it("combines unit and item Holdings in one Fit score and reason", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const response = await request(app)
      .get("/api/comps")
      .query({ units: ["Fenwick"], items: ["Guinsoo's Rageblade"] });

    const sniperComp = response.body.comps.find(
      (comp: { id: string }) => comp.id === "wildwood-snipers",
    );
    expect(sniperComp.fit.score).toBe(40);
    expect(sniperComp.fit.heldItems).toEqual(["Guinsoo's Rageblade"]);
    expect(sniperComp.fit.reason).toBe("Holding 1 of 2 units, 1 of 3 items");
  });

  it("lets item Holdings alone lift a lower-Tier Comp to the top", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const response = await request(app)
      .get("/api/comps")
      .query({ items: ["Warmog's Armor", "Sunfire Cape", "Gargoyle Stoneplate"] });

    expect(response.body.comps[0].id).toBe("bruiser-brawlers");
  });

  it("carries each Comp's final board and item priorities", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const response = await request(app).get("/api/comps");

    const sniperComp = response.body.comps.find(
      (comp: { id: string }) => comp.id === "wildwood-snipers",
    );
    expect(sniperComp.tier).toBe("A");
    expect(sniperComp.board).toEqual([
      {
        unit: "Fenwick",
        apiName: "DA_18_Fenwick",
        cost: 3,
        items: ["Guinsoo's Rageblade"],
        itemApiNames: ["DA_GuinsoosRageblade"],
      },
      {
        unit: "Kaelen",
        apiName: "DA_18_Kaelen",
        cost: 4,
        items: ["Infinity Edge", "Last Whisper"],
        itemApiNames: ["DA_InfinityEdge", "DA_LastWhisper"],
      },
    ]);
    expect(sniperComp.itemPriorities).toEqual([
      "Guinsoo's Rageblade",
      "Infinity Edge",
      "Last Whisper",
    ]);
    expect(sniperComp.itemPriorityApiNames).toEqual([
      "DA_GuinsoosRageblade",
      "DA_InfinityEdge",
      "DA_LastWhisper",
    ]);
  });
});

describe("GET /api/comps with augment data in the source", () => {
  const augmentFixturesDir = path.join(fixturesDir, "with-augments");

  it("raises a synergizing Comp above a top-Tier Comp when a held augment matches", async () => {
    const app = createApp({ dataDir: augmentFixturesDir });

    const response = await request(app)
      .get("/api/comps")
      .query({ augments: ["Wild Growth"] });

    expect(response.status).toBe(200);
    expect(response.body.comps.map((comp: { id: string }) => comp.id)).toEqual([
      "wildwood-snipers",
      "faerie-spellweavers",
      "bruiser-brawlers",
    ]);
    const sniperComp = response.body.comps[0];
    expect(sniperComp.fit.score).toBe(20);
    expect(sniperComp.fit.matchedAugments).toEqual(["Wild Growth"]);
    expect(sniperComp.fit.reason).toBe("Holding 0 of 2 units, 1 synergizing augment");
  });

  it("combines augments with unit and item Holdings in one reason", async () => {
    const app = createApp({ dataDir: augmentFixturesDir });

    const response = await request(app)
      .get("/api/comps")
      .query({
        units: ["Fenwick"],
        items: ["Guinsoo's Rageblade"],
        augments: ["Wild Growth", "Hunter's Focus"],
      });

    const sniperComp = response.body.comps.find(
      (comp: { id: string }) => comp.id === "wildwood-snipers",
    );
    expect(sniperComp.fit.score).toBe(80);
    expect(sniperComp.fit.matchedAugments).toEqual(["Wild Growth", "Hunter's Focus"]);
    expect(sniperComp.fit.reason).toBe(
      "Holding 1 of 2 units, 1 of 3 items, 2 synergizing augments",
    );
  });

  it("ranks the synergizing Comp higher when two Comps are otherwise complete", async () => {
    const app = createApp({ dataDir: augmentFixturesDir });

    const response = await request(app)
      .get("/api/comps")
      .query({
        units: ["Fenwick", "Kaelen", "Lilna", "Sylvara"],
        items: [
          "Guinsoo's Rageblade",
          "Infinity Edge",
          "Last Whisper",
          "Jeweled Gauntlet",
          "Spear of Shojin",
          "Rabadon's Deathcap",
        ],
        augments: ["Wild Growth"],
      });

    // Both the A Comp and the S Comp are fully held; the augment must still
    // lift the synergizing A Comp past the S Comp, and the displayed score
    // stays capped at 100.
    expect(response.body.comps[0].id).toBe("wildwood-snipers");
    expect(response.body.comps[0].fit.score).toBe(100);
  });

  it("scores a Comp without augment data exactly as if augments did not exist", async () => {
    const app = createApp({ dataDir: augmentFixturesDir });

    const without = await request(app).get("/api/comps");
    const withAugment = await request(app)
      .get("/api/comps")
      .query({ augments: ["Wild Growth"] });

    const findBruisers = (body: { comps: Array<{ id: string; fit: CompFit }> }) =>
      body.comps.find((comp) => comp.id === "bruiser-brawlers")!;
    expect(findBruisers(withAugment.body).fit.score).toBe(
      findBruisers(without.body).fit.score,
    );
    expect(findBruisers(withAugment.body).fit.matchedAugments).toEqual([]);
  });

  it("gives an entered augment no credit toward Comps that do not list it", async () => {
    const app = createApp({ dataDir: augmentFixturesDir });

    const response = await request(app)
      .get("/api/comps")
      .query({ augments: ["Faerie Blessing"] });

    const sniperComp = response.body.comps.find(
      (comp: { id: string }) => comp.id === "wildwood-snipers",
    );
    expect(sniperComp.fit.score).toBe(0);
    expect(sniperComp.fit.matchedAugments).toEqual([]);
  });
});

describe("GET /api/comps without augment data in the source", () => {
  it("leaves scores and ranking untouched when augments are entered anyway", async () => {
    const app = createApp({ dataDir: fixturesDir });

    const without = await request(app).get("/api/comps");
    const withAugments = await request(app)
      .get("/api/comps")
      .query({ augments: ["Wild Growth", "Faerie Blessing"] });

    expect(withAugments.status).toBe(200);
    const summarize = (body: { comps: Array<{ id: string; fit: CompFit }> }) =>
      body.comps.map((comp) => ({ id: comp.id, score: comp.fit.score }));
    expect(summarize(withAugments.body)).toEqual(summarize(without.body));
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
