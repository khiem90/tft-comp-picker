import fs from "node:fs";
import path from "node:path";
import express from "express";
import type { Comp, CompFit, RankedComp, SetItem, Tier } from "../shared/types";

export interface CompsFile {
  patch: string;
  refreshedAt: string;
  source: string;
  comps: Comp[];
}

interface Holdings {
  units: string[];
  items: string[];
}

const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D"];

// Weight per Tier step. Orders Comps when Fit is zero, and keeps Tier in
// charge until real overlap accumulates: with a 6-unit board and 4 priority
// items, a B Comp needs two held pieces (units, or a full item's worth of
// credit) to pass an empty S Comp, and half a board beats any Tier gap.
const TIER_STEP = 0.1;

function tierPosition(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

function tierWeight(tier: Tier): number {
  return (TIER_ORDER.length - 1 - tierPosition(tier)) * TIER_STEP;
}

interface ItemCredit {
  item: string;
  // 1 when the completed item is held, else the held fraction of its
  // components. Each held item or component is spent on one priority slot.
  credit: number;
  completedHeld: boolean;
}

function itemCredits(
  priorities: string[],
  setItems: SetItem[],
  heldItems: string[],
): ItemCredit[] {
  const pool = [...heldItems];
  const take = (name: string): boolean => {
    const index = pool.indexOf(name);
    if (index === -1) return false;
    pool.splice(index, 1);
    return true;
  };
  const componentsOf = (item: string): string[] =>
    setItems.find((setItem) => setItem.name === item)?.components ?? [];
  const canBuild = (components: string[]): boolean => {
    const unspent = [...pool];
    return components.every((component) => {
      const index = unspent.indexOf(component);
      if (index === -1) return false;
      unspent.splice(index, 1);
      return true;
    });
  };

  // Three passes, most complete claim first, so a full item held (or fully
  // buildable) is never split into partial credit across its neighbours.
  const credits = priorities.map((item) => {
    const completedHeld = take(item);
    return { item, credit: completedHeld ? 1 : 0, completedHeld };
  });
  for (const entry of credits) {
    if (entry.completedHeld) continue;
    const components = componentsOf(entry.item);
    if (components.length > 0 && canBuild(components)) {
      components.forEach(take);
      entry.credit = 1;
    }
  }
  for (const entry of credits) {
    if (entry.credit > 0) continue;
    const components = componentsOf(entry.item);
    if (components.length === 0) continue;
    entry.credit = components.filter(take).length / components.length;
  }
  return credits;
}

function fitReason(
  comp: Comp,
  holdings: Holdings,
  heldUnitCount: number,
  heldItemCount: number,
  partialItemCount: number,
): string {
  if (holdings.units.length === 0 && holdings.items.length === 0) {
    return "No Holdings yet, ranked by Tier";
  }
  const itemCount = comp.itemPriorities.length;
  const clauses = [`${heldUnitCount} of ${comp.board.length} units`];
  if (heldItemCount > 0) clauses.push(`${heldItemCount} of ${itemCount} items`);
  if (partialItemCount > 0) {
    clauses.push(
      heldItemCount > 0
        ? `components toward ${partialItemCount} more`
        : `components toward ${partialItemCount} of ${itemCount} items`,
    );
  }
  return `Holding ${clauses.join(", ")}`;
}

function scoreComp(
  comp: Comp,
  holdings: Holdings,
  setItems: SetItem[],
): { ranking: number; fit: CompFit } {
  const heldUnits: string[] = [];
  const missingUnits: string[] = [];
  for (const slot of comp.board) {
    (holdings.units.includes(slot.unit) ? heldUnits : missingUnits).push(slot.unit);
  }

  const credits = itemCredits(comp.itemPriorities, setItems, holdings.items);
  const heldItems = credits.filter((c) => c.completedHeld).map((c) => c.item);
  const partialItems = credits
    .filter((c) => !c.completedHeld && c.credit > 0)
    .map((c) => c.item);
  const missingItems = credits.filter((c) => c.credit === 0).map((c) => c.item);

  const heldPieces =
    heldUnits.length + credits.reduce((total, c) => total + c.credit, 0);
  const totalPieces = comp.board.length + comp.itemPriorities.length;
  const fraction = totalPieces === 0 ? 0 : heldPieces / totalPieces;

  return {
    ranking: fraction + tierWeight(comp.tier),
    fit: {
      score: Math.round(fraction * 100),
      heldUnits,
      missingUnits,
      heldItems,
      partialItems,
      missingItems,
      reason: fitReason(comp, holdings, heldUnits.length, heldItems.length, partialItems.length),
    },
  };
}

function parseNames(raw: unknown): string[] {
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.filter((name) => typeof name === "string");
  return [];
}

function readJson<T>(dataDir: string, fileName: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

export function createApp({ dataDir }: { dataDir: string }) {
  const app = express();

  app.get("/api/comps", (req, res) => {
    const holdings: Holdings = {
      units: parseNames(req.query.units),
      items: parseNames(req.query.items),
    };
    const compsFile = readJson<CompsFile>(dataDir, "comps.json");
    const setItems = readJson<{ items?: SetItem[] }>(dataDir, "set-data.json").items ?? [];
    const ranked: RankedComp[] = compsFile.comps
      .map((comp) => ({ comp, scored: scoreComp(comp, holdings, setItems) }))
      .sort((a, b) => b.scored.ranking - a.scored.ranking)
      .map(({ comp, scored }) => ({ ...comp, fit: scored.fit }));
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
