import fs from "node:fs";
import path from "node:path";
import express from "express";
import type { Comp, CompFit, RankedComp, Tier } from "../shared/types";

export interface CompsFile {
  patch: string;
  refreshedAt: string;
  source: string;
  comps: Comp[];
}

const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D"];

// Weight per Tier step. Orders Comps when Fit is zero, and keeps Tier in
// charge until real overlap accumulates: on a 9-unit board a B Comp needs two
// held units to pass an empty S Comp, and half a board beats any Tier gap.
const TIER_STEP = 0.1;

function tierPosition(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

function tierWeight(tier: Tier): number {
  return (TIER_ORDER.length - 1 - tierPosition(tier)) * TIER_STEP;
}

function unitFit(comp: Comp, heldUnits: string[]): number {
  if (comp.board.length === 0) return 0;
  const held = comp.board.filter((slot) => heldUnits.includes(slot.unit)).length;
  return held / comp.board.length;
}

function rankingScore(comp: Comp, heldUnits: string[]): number {
  return unitFit(comp, heldUnits) + tierWeight(comp.tier);
}

function compFit(comp: Comp, heldUnits: string[]): CompFit {
  const held: string[] = [];
  const missing: string[] = [];
  for (const slot of comp.board) {
    (heldUnits.includes(slot.unit) ? held : missing).push(slot.unit);
  }
  const reason =
    heldUnits.length === 0
      ? "No Holdings yet, ranked by Tier"
      : `Holding ${held.length} of ${comp.board.length} units`;
  return {
    score: Math.round(unitFit(comp, heldUnits) * 100),
    heldUnits: held,
    missingUnits: missing,
    reason,
  };
}

function parseUnits(raw: unknown): string[] {
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.filter((unit) => typeof unit === "string");
  return [];
}

function readJson<T>(dataDir: string, fileName: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

export function createApp({ dataDir }: { dataDir: string }) {
  const app = express();

  app.get("/api/comps", (req, res) => {
    const heldUnits = parseUnits(req.query.units);
    const compsFile = readJson<CompsFile>(dataDir, "comps.json");
    const ranked: RankedComp[] = compsFile.comps
      .map((comp) => ({ comp, score: rankingScore(comp, heldUnits) }))
      .sort((a, b) => b.score - a.score)
      .map(({ comp }) => ({ ...comp, fit: compFit(comp, heldUnits) }));
    res.json({
      patch: compsFile.patch,
      refreshedAt: compsFile.refreshedAt,
      comps: ranked,
    });
  });

  app.get("/api/set-data", (_req, res) => {
    res.json(readJson(dataDir, "set-data.json"));
  });

  return app;
}
