import { useEffect, useState } from "react";
import type { CompsResponse, SetDataResponse } from "../shared/types";
import { clearActiveGame, loadActiveGame, saveActiveGame } from "./activeGame";
import {
  anyFilterActive,
  EMPTY_FILTERS,
  filterOptions,
  matchesFilters,
  pruneFilters,
  type FilterSelection,
} from "./filters";
import { AppHeader } from "./components/AppHeader";
import { AugmentsSection } from "./components/AugmentsSection";
import { CompList } from "./components/CompList";
import { FiltersPanel } from "./components/FiltersPanel";
import { ItemsSection } from "./components/ItemsSection";
import { StatusBanners } from "./components/StatusBanners";
import { StatusRail } from "./components/StatusRail";
import { UnitsSection } from "./components/UnitsSection";

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

export function App() {
  const [comps, setComps] = useState<CompsResponse | null>(null);
  const [setData, setSetData] = useState<SetDataResponse | null>(null);
  // One read restores the whole Active game; three separate loads could mix
  // Holdings from different saved games if another tab wrote in between.
  const [restored] = useState(() => loadActiveGame(localStorage));
  const [heldUnits, setHeldUnits] = useState<string[]>(restored.units);
  const [heldItems, setHeldItems] = useState<string[]>(restored.items);
  const [heldAugments, setHeldAugments] = useState<string[]>(restored.augments);
  const [search, setSearch] = useState("");
  // View-only state: filters narrow what the comp column shows and never
  // touch the ranking request, so the order within results stays the
  // server's order.
  const [filters, setFilters] = useState<FilterSelection>(EMPTY_FILTERS);
  const [itemSearch, setItemSearch] = useState("");
  const [augmentSearch, setAugmentSearch] = useState("");
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
              className="panel-button"
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
  const removeItemAt = (index: number) => {
    setHeldItems((held) => held.filter((_, position) => position !== index));
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
  };

  // The augment picker exists only while augments can move a ranking: the
  // catalog must offer choices and at least one Comp must carry augment
  // synergies (see Comp.augments in shared/types.ts).
  const augmentChoices = setData.augments ?? [];
  const augmentsUsable =
    augmentChoices.length > 0 &&
    comps.comps.some((comp) => (comp.augments ?? []).length > 0);

  // Ranks are assigned before filtering so every card keeps its position in
  // the full ranking; a filter hides cards, it never promotes one.
  const rankedEntries = comps.comps.map((comp, index) => ({
    comp,
    rank: index + 1,
  }));
  const visibleEntries = rankedEntries.filter((entry) =>
    matchesFilters(entry.comp, filters),
  );

  return (
    <main className="app-shell">
      <AppHeader onNewGame={startNewGame} />

      <div className="shell-body">
        {/* Banners span the full shell width, above the columns: a source
            failure should interrupt the whole dashboard, not one rail. */}
        <StatusBanners
          fetchError={fetchError}
          refreshError={comps.refreshError}
          patchChange={comps.patchChange}
        />

        <div className="dashboard">
          <aside className="rail rail-holdings">
            <h2 className="column-title">My Holdings</h2>
            <UnitsSection
              units={setData.units}
              held={heldUnits}
              search={search}
              onSearchChange={setSearch}
              onAdd={addUnit}
              onRemove={removeUnit}
            />
            <ItemsSection
              items={setData.items}
              components={setData.components}
              held={heldItems}
              search={itemSearch}
              onSearchChange={setItemSearch}
              onAdd={addItem}
              onRemoveAt={removeItemAt}
            />
            <AugmentsSection
              choices={augmentChoices}
              canMoveRanking={augmentsUsable}
              held={heldAugments}
              search={augmentSearch}
              onSearchChange={setAugmentSearch}
              onAdd={addAugment}
              onRemove={removeAugment}
            />
          </aside>

          <section className="comp-column">
            <h2 className="column-title">Top Comps</h2>
            {visibleEntries.length === 0 && anyFilterActive(filters) ? (
              <div className="comp-empty">
                <p>No Comps match the active filters.</p>
                <button
                  type="button"
                  className="panel-button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <CompList
                entries={visibleEntries}
                icons={{
                  traits: new Map(setData.traits.map((trait) => [trait.apiName, trait.icon])),
                  units: new Map(setData.units.map((unit) => [unit.apiName, unit.icon])),
                  items: new Map(setData.items.map((item) => [item.apiName, item.icon])),
                }}
              />
            )}
          </section>

          <aside className="rail rail-status">
            <StatusRail
              patch={comps.patch}
              refreshedAt={comps.refreshedAt}
              refreshing={refreshing}
              onRefresh={refreshNow}
            />
            <FiltersPanel
              options={filterOptions(comps.comps)}
              selection={filters}
              onSelectionChange={setFilters}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
