import fs from "node:fs";
import path from "node:path";
import express from "express";

export interface BoardSlot {
  unit: string;
  cost: number;
  items: string[];
}

export interface Comp {
  id: string;
  name: string;
  tier: string;
  board: BoardSlot[];
  itemPriorities: string[];
}

export interface CompsFile {
  patch: string;
  refreshedAt: string;
  source: string;
  comps: Comp[];
}

const TIER_ORDER = ["S", "A", "B", "C", "D"];

function tierRank(tier: string): number {
  const rank = TIER_ORDER.indexOf(tier);
  return rank === -1 ? TIER_ORDER.length : rank;
}

function readJson<T>(dataDir: string, fileName: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

export function createApp({ dataDir }: { dataDir: string }) {
  const app = express();

  app.get("/api/comps", (_req, res) => {
    const compsFile = readJson<CompsFile>(dataDir, "comps.json");
    const ranked = [...compsFile.comps].sort(
      (a, b) => tierRank(a.tier) - tierRank(b.tier),
    );
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
