import { useEffect, useState } from "react";
import type { CompsResponse, RankedComp, SetDataResponse } from "../shared/types";
import { clearActiveGame, loadActiveGame, saveActiveGame } from "./activeGame";
import { TIER_ORDER } from "./comps";
import {
  anyFilterActive,
  EMPTY_FILTERS,
  filterOptions,
  matchesFilters,
  pruneFilters,
  type FilterSelection,
} from "./filters";
import { AppHeader, type HeldItemChip } from "./components/AppHeader";
import { CompDrawer } from "./components/CompDrawer";
import { FiltersPanel } from "./components/FiltersPanel";
import { HoldingsPanel } from "./components/HoldingsPanel";
import { StatusBanners } from "./components/StatusBanners";
import { TierLanes, type RankedEntry } from "./components/TierLanes";

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`Server answered ${response.status}`);
    return response.json() as Promise<T>;
  });
}

function compsUrl(
  heldUnits: string[],
  heldItems: string[],
  heldAugments: string[],
): string {
  const params = new URLSearchParams();
  for (const unit of heldUnits) params.append("units", unit);
  for (const item of heldItems) params.append("items", item);
  for (const augment of heldAugments) params.append("augments", augment);
  const query = params.toString();
  return query ? `/api/comps?${query}` : "/api/comps";
}

// The sentence under the lane that holds the overall best when a stronger
// lane exists above it. Fit can lift an A Comp over every S Comp, and the
// page says so rather than leaving the flag looking misplaced. Null when the
// best already sits in the top lane, or when there are no Holdings (the
// ranking is then pure Tier order and the flag explains itself).
function laneNoteFor(best: RankedComp | undefined, comps: RankedComp[], holdingsEmpty: boolean) {
  if (!best || holdingsEmpty) return null;
  const bestIndex = TIER_ORDER.indexOf(best.tier);
  const stronger = TIER_ORDER.filter(
    (tier, index) => index < bestIndex && comps.some((comp) => comp.tier === tier),
  );
  if (stronger.length === 0) return null;
  return `${best.name} outranks every ${stronger.join(" and ")} comp because you hold ${
    best.fit.heldUnits.length
  } of its ${best.board.length} units. Tier weights the ranking, fit drives it.`;
}

export function App() {
  const [comps, setComps] = useState<CompsResponse | null>(null);
  const [setData, setSetData] = useState<SetDataResponse | null>(null);
  // One read restores the whole Active game; three separate loads could mix
  // Holdings from different saved games if another tab wrote in between.
  const [restored] = useState(() => loadActiveGame(localStorage));
  const [heldUnits, setHeldUnits] = useState<string[]>(restored.units);
  const [heldItems, setHeldItems] = useState<string[]>(restored.items);
  const [heldAugments, setHeldAugments] = useState<string[]>(restored.augments);
  // The picker opens by itself on an empty game, where adding is the only
  // useful action; with Holdings restored it stays out of the way.
  const [panelOpen, setPanelOpen] = useState(
    restored.units.length + restored.items.length + restored.augments.length === 0,
  );
  const [search, setSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [augmentSearch, setAugmentSearch] = useState("");
  // View-only state: filters narrow what the lanes show and never touch the
  // ranking request, so the order within lanes stays the server's order.
  const [filters, setFilters] = useState<FilterSelection>(EMPTY_FILTERS);
  // null follows the overall best as Holdings change; a click pins one Comp
  // until a New game or a Refresh that drops it.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // One error per fetch, cleared by that fetch's next success. A shared flag
  // would let a Comps success erase a still-broken Set data read.
  const [compsError, setCompsError] = useState<string | null>(null);
  const [setDataError, setSetDataError] = useState<string | null>(null);
  // Bumped after a manual Refresh so both server reads run again.
  const [dataVersion, setDataVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchJson<SetDataResponse>("/api/set-data")
      .then((body) => {
        setSetData(body);
        setSetDataError(null);
      })
      .catch((cause: Error) => setSetDataError(cause.message));
  }, [dataVersion]);

  useEffect(() => {
    let superseded = false;
    fetchJson<CompsResponse>(compsUrl(heldUnits, heldItems, heldAugments))
      .then((body) => {
        if (superseded) return;
        setComps(body);
        setCompsError(null);
      })
      .catch((cause: Error) => {
        if (!superseded) setCompsError(cause.message);
      });
    return () => {
      superseded = true;
    };
  }, [heldUnits, heldItems, heldAugments, dataVersion]);

  // A Refresh can remove a Tier, Trait, or Playstyle from the data; a
  // selection pointing at a vanished option would filter everything out
  // while its dropdown shows All. Vanished selections reset to All for real.
  useEffect(() => {
    if (!comps) return;
    const options = filterOptions(comps.comps);
    setFilters((current) => pruneFilters(current, options));
  }, [comps]);

  // Whether the Refresh succeeded or not, re-read from the server: on failure
  // the response carries refreshError, which is how the failure is shown.
  const refreshNow = () => {
    setRefreshing(true);
    fetch("/api/refresh", { method: "POST" })
      .catch(() => undefined)
      .then(() => {
        setRefreshing(false);
        setDataVersion((version) => version + 1);
      });
  };

  // The Active game survives reloads: every Holdings change lands in browser
  // storage immediately, so there is no moment where a crash loses entries.
  useEffect(() => {
    saveActiveGame(localStorage, {
      units: heldUnits,
      items: heldItems,
      augments: heldAugments,
    });
  }, [heldUnits, heldItems, heldAugments]);

  const fetchError = compsError ?? setDataError;

  // A failed fetch never unmounts a working app. With no data yet the status
  // screen offers a Retry; once data has loaded, later failures only show a
  // banner (below) and the last good data keeps serving.
  if (!comps || !setData) {
    return (
      <main className="status-screen">
        {fetchError ? (
          <>
            <p className="status">Could not load Comps: {fetchError}</p>
            <button
              type="button"
              className="button"
              onClick={() => setDataVersion((version) => version + 1)}
            >
              Retry
            </button>
          </>
        ) : (
          <p className="status">Loading Comps…</p>
        )}
      </main>
    );
  }

  const addUnit = (name: string) => {
    setHeldUnits((held) => [...held, name]);
    setSearch("");
  };
  const removeUnit = (name: string) => {
    setHeldUnits((held) => held.filter((unit) => unit !== name));
  };
  const addItem = (name: string) => {
    setHeldItems((held) => [...held, name]);
    setItemSearch("");
  };
  // Items are a multiset; removing takes the most recently added copy.
  const removeItem = (name: string) => {
    setHeldItems((held) => {
      const index = held.lastIndexOf(name);
      return index === -1 ? held : held.filter((_, position) => position !== index);
    });
  };
  const addAugment = (name: string) => {
    setHeldAugments((held) => [...held, name]);
    setAugmentSearch("");
  };
  const removeAugment = (name: string) => {
    setHeldAugments((held) => held.filter((augment) => augment !== name));
  };
  // One interaction, whole reset: the previous game is discarded, not archived.
  // Storage is wiped here so the discard doesn't wait on React; the persist
  // effect then re-saves the now-empty game, which reads back the same.
  const startNewGame = () => {
    clearActiveGame(localStorage);
    setHeldUnits([]);
    setHeldItems([]);
    setHeldAugments([]);
    setSearch("");
    setItemSearch("");
    setAugmentSearch("");
    setSelectedId(null);
    setPanelOpen(true);
  };

  // The augment picker exists only while augments can move a ranking: the
  // catalog must offer choices and at least one Comp must carry augment
  // synergies (see Comp.augments in shared/types.ts).
  const augmentChoices = setData.augments ?? [];
  const augmentsUsable =
    augmentChoices.length > 0 &&
    comps.comps.some((comp) => (comp.augments ?? []).length > 0);

  // Ranks are assigned before filtering so every tile keeps its position in
  // the full ranking; a filter hides tiles, it never promotes one.
  const rankedEntries: RankedEntry[] = comps.comps.map((comp, index) => ({
    comp,
    rank: index + 1,
  }));
  const visibleEntries = rankedEntries.filter((entry) =>
    matchesFilters(entry.comp, filters),
  );
  const holdingsEmpty =
    heldUnits.length === 0 && heldItems.length === 0 && heldAugments.length === 0;
  const best = rankedEntries[0];
  // A pinned Comp that a Refresh removed falls back to the best, silently:
  // the drawer always shows something the lanes contain.
  const selected =
    rankedEntries.find((entry) => entry.comp.id === selectedId) ?? best;

  const icons = {
    traits: new Map(setData.traits.map((trait) => [trait.apiName, trait.icon])),
    units: new Map(setData.units.map((unit) => [unit.apiName, unit.icon])),
    items: new Map(setData.items.map((item) => [item.apiName, item.icon])),
  };
  // Held item names can be components or completed items; one map answers
  // both. Duplicates collapse to one chip with a count, in first-added order.
  const itemIconByName = new Map<string, string | undefined>();
  for (const component of setData.components ?? []) {
    itemIconByName.set(component.name, component.icon);
  }
  for (const item of setData.items) itemIconByName.set(item.name, item.icon);
  const heldItemChips: HeldItemChip[] = [];
  for (const name of heldItems) {
    const chip = heldItemChips.find((candidate) => candidate.name === name);
    if (chip) chip.count += 1;
    else heldItemChips.push({ name, count: 1, icon: itemIconByName.get(name) });
  }

  return (
    <main className="app-shell">
      <AppHeader
        units={setData.units}
        heldUnits={heldUnits}
        heldItems={heldItemChips}
        heldAugments={heldAugments}
        onRemoveUnit={removeUnit}
        onRemoveItem={removeItem}
        onRemoveAugment={removeAugment}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((open) => !open)}
        patch={comps.patch}
        refreshedAt={comps.refreshedAt}
        refreshing={refreshing}
        onRefresh={refreshNow}
        onNewGame={startNewGame}
      />
      {panelOpen && (
        <HoldingsPanel
          units={setData.units}
          items={setData.items}
          augmentChoices={augmentChoices}
          augmentsUsable={augmentsUsable}
          heldUnits={heldUnits}
          heldAugments={heldAugments}
          search={search}
          itemSearch={itemSearch}
          augmentSearch={augmentSearch}
          onSearchChange={setSearch}
          onItemSearchChange={setItemSearch}
          onAugmentSearchChange={setAugmentSearch}
          onAddUnit={addUnit}
          onAddItem={addItem}
          onAddAugment={addAugment}
        />
      )}

      {/* Banners span the full width above the lanes: a source failure
          should interrupt the whole page, not one column. */}
      <StatusBanners
        fetchError={fetchError}
        refreshError={comps.refreshError}
        patchChange={comps.patchChange}
      />

      <div className="page">
        <section className="lanes-column">
          <FiltersPanel
            options={filterOptions(comps.comps)}
            selection={filters}
            onSelectionChange={setFilters}
          />
          {visibleEntries.length === 0 && anyFilterActive(filters) ? (
            <div className="comp-empty">
              <p>No Comps match the active filters.</p>
              <button type="button" className="button" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear all filters
              </button>
            </div>
          ) : (
            <TierLanes
              entries={visibleEntries}
              selectedId={selected?.comp.id ?? ""}
              onSelect={setSelectedId}
              icons={icons}
              holdingsEmpty={holdingsEmpty}
              laneNote={laneNoteFor(best?.comp, comps.comps, holdingsEmpty)}
            />
          )}
        </section>
        {selected && <CompDrawer comp={selected.comp} rank={selected.rank} icons={icons} />}
      </div>
    </main>
  );
}
