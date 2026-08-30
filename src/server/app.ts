import fs from "node:fs";
import path from "node:path";
import express from "express";
import type { Comp, Tier } from "../shared/types";

export interface CompsFile {
  patch: string;
  refreshedAt: string;
  source: string;
  comps: Comp[];
}

const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D"];

function tierPosition(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

function readJson<T>(dataDir: string, fileName: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

export function createApp({ dataDir }: { dataDir: string }) {
  const app = express();

  app.get("/api/comps", (_req, res) => {
    const compsFile = readJson<CompsFile>(dataDir, "comps.json");
    const ranked = [...compsFile.comps].sort(
      (a, b) => tierPosition(a.tier) - tierPosition(b.tier),
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
