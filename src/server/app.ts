import express from "express";
import type {
  Comp,
  CompFit,
  PatchChange,
  RankedComp,
  SetItem,
  Tier,
  TierMove,
} from "../shared/types";
import { applyIconRefs, downloadIcons } from "./icons";
import { fetchAllCompDetails, transformSources, type SourceFetcher } from "./sources";
import { createDiskStorage, type Storage } from "./storage";

export type { CompsFile } from "./sources";
import type { CompsFile } from "./sources";

interface Holdings {
  units: string[];
  items: string[];
  augments: string[];
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
  matchedAugmentCount: number,
): string {
  if (
    holdings.units.length === 0 &&
    holdings.items.length === 0 &&
    holdings.augments.length === 0
  ) {
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
  if (matchedAugmentCount > 0) {
    clauses.push(
      `${matchedAugmentCount} synergizing augment${matchedAugmentCount === 1 ? "" : "s"}`,
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

  // A matched augment counts as one held piece, but augments never join the
  // denominator: a Comp the source has no augment data for must score exactly
  // as it would if augments did not exist.
  const matchedAugments = (comp.augments ?? []).filter((augment) =>
    holdings.augments.includes(augment),
  );

  const heldPieces =
    heldUnits.length +
    credits.reduce((total, c) => total + c.credit, 0) +
    matchedAugments.length;
  const totalPieces = comp.board.length + comp.itemPriorities.length;
  // Matched augments can push the fraction past 1. The ranking keeps the
  // overflow so a synergizing Comp beats an equally complete one without
  // augment data; only the displayed score caps at 100.
  const fraction = totalPieces === 0 ? 0 : heldPieces / totalPieces;

  return {
    ranking: fraction + tierWeight(comp.tier),
    fit: {
      score: Math.min(100, Math.round(fraction * 100)),
      heldUnits,
      missingUnits,
      heldItems,
      partialItems,
      missingItems,
      matchedAugments,
      reason: fitReason(
        comp,
        holdings,
        heldUnits.length,
        heldItems.length,
        partialItems.length,
        matchedAugments.length,
      ),
    },
  };
}

function parseNames(raw: unknown): string[] {
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.filter((name) => typeof name === "string");
  return [];
}

// Comps are matched by name across the boundary, not by id: MetaTFT's cluster
// ids are artifacts of each stats snapshot and can be renumbered wholesale,
// while the trait-plus-carry name is the identity a player recognizes.
function patchChangeBetween(
  previous: CompsFile | null,
  next: CompsFile,
): PatchChange | undefined {
  if (previous === null || previous.patch === next.patch) return undefined;
  const previousByName = new Map(previous.comps.map((comp) => [comp.name, comp]));
  const nextNames = new Set(next.comps.map((comp) => comp.name));
  const tierMoves: TierMove[] = [];
  for (const comp of next.comps) {
    const before = previousByName.get(comp.name);
    if (before && before.tier !== comp.tier) {
      tierMoves.push({ name: comp.name, from: before.tier, to: comp.tier });
    }
  }
  return {
    fromPatch: previous.patch,
    toPatch: next.patch,
    addedComps: next.comps
      .filter((comp) => !previousByName.has(comp.name))
      .map((comp) => comp.name),
    removedComps: previous.comps
      .filter((comp) => !nextNames.has(comp.name))
      .map((comp) => comp.name),
    tierMoves,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CreateAppOptions {
  // Where data lives: a local directory, or any Storage implementation.
  // Exactly one of the two; dataDir is shorthand for disk storage.
  dataDir?: string;
  storage?: Storage;
  // Absent in tests that only exercise ranking; then the app serves whatever
  // the store holds and never Refreshes.
  fetcher?: SourceFetcher;
  now?: () => number;
}

export function createApp({ dataDir, storage, fetcher, now = Date.now }: CreateAppOptions) {
  if (!storage === !dataDir) {
    throw new Error("createApp needs exactly one of dataDir and storage");
  }
  const store = storage ?? createDiskStorage(dataDir!);
  const app = express();

  // The icon files a Refresh downloaded, when they are local files. Serving
  // them from disk is what keeps rendering offline: the UI never asks a
  // third-party host for an image. Blob-backed storage serves its own URLs
  // instead.
  if (store.localIconsDir) {
    app.use("/icons", express.static(store.localIconsDir));
  }

  // The message of the most recent failed Refresh, cleared by a success.
  // Served alongside Comps so the UI can say the rankings are running on
  // last good data. Persisted beside the data so a restart, or another
  // server instance on shared storage, still reports degraded mode; the
  // in-memory copy is the fallback when the state document is unreadable.
  let memoryRefreshError: string | null = null;
  const loadRefreshError = async (): Promise<string | null> => {
    try {
      const state = await store.readJson<{ error: string | null }>(
        "refresh-state.json",
      );
      return state.error;
    } catch {
      return memoryRefreshError;
    }
  };
  const saveRefreshError = async (error: string | null): Promise<void> => {
    memoryRefreshError = error;
    try {
      await store.writeJson("refresh-state.json", { error });
    } catch {
      // The in-memory copy carries it for this instance's lifetime.
    }
  };

  let inFlight: Promise<void> | null = null;

  const refresh = (activeFetcher: SourceFetcher): Promise<void> => {
    inFlight ??= (async () => {
      try {
        const payloads = await activeFetcher.fetchSources();
        // Comp-details ride the same Refresh as the clusters they describe:
        // cluster ids rotate with the source's generation, so details fetched
        // any later could belong to a different cluster set.
        const compDetails = await fetchAllCompDetails(activeFetcher, payloads.compsData);
        const refreshedAt = new Date(now()).toISOString();
        const { compsFile, setData, iconJobs } = transformSources(
          payloads,
          refreshedAt,
          compDetails,
        );
        let previous: CompsFile | null;
        try {
          previous = await store.readJson<CompsFile>("comps.json");
        } catch {
          previous = null;
        }
        const patchChange = patchChangeBetween(previous, compsFile);
        if (patchChange) compsFile.patchChange = patchChange;
        // Icons land before the JSON that references them, and only the ones
        // in the store get referenced: an icon failure degrades to a
        // fallback tile, never to a failed Refresh. With no readable
        // previous comps.json the Patch of any surviving icons is
        // unknowable, so they count as stale too.
        const availableIcons = await downloadIcons({
          storage: store,
          jobs: iconJobs,
          fetcher: activeFetcher,
          patchChanged: previous === null || previous.patch !== compsFile.patch,
        });
        applyIconRefs(setData, availableIcons);
        await store.writeJson("comps.json", compsFile);
        await store.writeJson("set-data.json", setData);
        await saveRefreshError(null);
      } catch (cause) {
        await saveRefreshError(
          cause instanceof Error ? cause.message : String(cause),
        );
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };

  // Null means "no usable data". Both documents must parse: a fresh
  // comps.json beside a missing or corrupt set-data.json still needs the
  // Refresh that rewrites the pair.
  const dataAgeMs = async (): Promise<number | null> => {
    try {
      await store.readJson<unknown>("set-data.json");
      const { refreshedAt } = await store.readJson<CompsFile>("comps.json");
      const timestamp = Date.parse(refreshedAt);
      return Number.isNaN(timestamp) ? null : now() - timestamp;
    } catch {
      return null;
    }
  };

  // The launch trigger, applied lazily: the first request older-than-24h data
  // (or no data at all) Refreshes before recommendations are served.
  const ensureFresh = async (): Promise<void> => {
    if (!fetcher) return;
    const age = await dataAgeMs();
    if (age === null || age > DAY_MS) await refresh(fetcher);
  };

  const serveMissingData = async (res: express.Response): Promise<void> => {
    res.status(503).json({
      error:
        (await loadRefreshError()) ??
        "No data files and no Refresh has succeeded yet",
    });
  };

  app.get("/api/comps", async (req, res) => {
    await ensureFresh();
    const holdings: Holdings = {
      units: parseNames(req.query.units),
      items: parseNames(req.query.items),
      augments: parseNames(req.query.augments),
    };
    let compsFile: CompsFile;
    let setItems: SetItem[];
    try {
      compsFile = await store.readJson<CompsFile>("comps.json");
      setItems =
        (await store.readJson<{ items?: SetItem[] }>("set-data.json")).items ?? [];
    } catch {
      await serveMissingData(res);
      return;
    }
    const ranked: RankedComp[] = compsFile.comps
      .map((comp) => ({ comp, scored: scoreComp(comp, holdings, setItems) }))
      .sort((a, b) => b.scored.ranking - a.scored.ranking)
      .map(({ comp, scored }) => ({ ...comp, fit: scored.fit }));
    res.json({
      patch: compsFile.patch,
      refreshedAt: compsFile.refreshedAt,
      refreshError: await loadRefreshError(),
      patchChange: compsFile.patchChange ?? null,
      comps: ranked,
    });
  });

  app.get("/api/set-data", async (_req, res) => {
    await ensureFresh();
    try {
      res.json(await store.readJson("set-data.json"));
    } catch {
      await serveMissingData(res);
    }
  });

  app.post("/api/refresh", async (_req, res) => {
    if (!fetcher) {
      res.status(503).json({ error: "No source fetcher configured" });
      return;
    }
    await refresh(fetcher);
    const refreshError = await loadRefreshError();
    if (refreshError !== null) {
      res.status(502).json({ error: refreshError });
      return;
    }
    const { patch, refreshedAt } = await store.readJson<CompsFile>("comps.json");
    res.json({ patch, refreshedAt });
  });

  return app;
}
