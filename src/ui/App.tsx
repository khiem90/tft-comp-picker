import { useEffect, useState } from "react";
import type { CompsResponse, SetDataResponse } from "../shared/types";

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`Server answered ${response.status}`);
    return response.json() as Promise<T>;
  });
}

function compsUrl(heldUnits: string[], heldItems: string[]): string {
  const params = new URLSearchParams();
  for (const unit of heldUnits) params.append("units", unit);
  for (const item of heldItems) params.append("items", item);
  const query = params.toString();
  return query ? `/api/comps?${query}` : "/api/comps";
}

interface ItemChoice {
  name: string;
  kind: "component" | "item";
  hint: string;
}

// The picker offers raw components ahead of completed items; mid-game the
// player mostly holds components.
function itemChoices(setData: SetDataResponse): ItemChoice[] {
  const components = [...new Set(setData.items.flatMap((item) => item.components))];
  return [
    ...components.map((name) => ({ name, kind: "component" as const, hint: "component" })),
    ...setData.items.map((item) => ({
      name: item.name,
      kind: "item" as const,
      hint: item.components.join(" + "),
    })),
  ];
}

function priorityState(item: string, fit: { heldItems: string[]; partialItems: string[] }) {
  if (fit.heldItems.includes(item)) return "held";
  if (fit.partialItems.includes(item)) return "partial";
  return "missing";
}

export function App() {
  const [comps, setComps] = useState<CompsResponse | null>(null);
  const [setData, setSetData] = useState<SetDataResponse | null>(null);
  const [heldUnits, setHeldUnits] = useState<string[]>([]);
  const [heldItems, setHeldItems] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<SetDataResponse>("/api/set-data")
      .then(setSetData)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  useEffect(() => {
    let superseded = false;
    fetchJson<CompsResponse>(compsUrl(heldUnits, heldItems))
      .then((body) => {
        if (!superseded) setComps(body);
      })
      .catch((cause: Error) => {
        if (!superseded) setError(cause.message);
      });
    return () => {
      superseded = true;
    };
  }, [heldUnits, heldItems]);

  if (error) return <p className="status">Could not load Comps: {error}</p>;
  if (!comps || !setData) return <p className="status">Loading Comps…</p>;

  const query = search.trim().toLowerCase();
  const matches = query
    ? setData.units.filter(
        (unit) =>
          !heldUnits.includes(unit.name) && unit.name.toLowerCase().includes(query),
      )
    : [];

  // Item Holdings are a multiset: two Giant's Belts are twice the credit, so
  // matches never exclude what is already held and removal takes one copy.
  const itemQuery = itemSearch.trim().toLowerCase();
  const itemMatches = itemQuery
    ? itemChoices(setData).filter((choice) =>
        choice.name.toLowerCase().includes(itemQuery),
      )
    : [];

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

  return (
    <main>
      <header>
        <h1>TFT Comp Picker</h1>
        <p className="meta">
          Patch {comps.patch} · refreshed {new Date(comps.refreshedAt).toLocaleString()}
        </p>
      </header>

      <section className="holdings">
        <h2>Your units</h2>
        <input
          type="search"
          className="picker-search"
          placeholder="Search units…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {matches.length > 0 && (
          <ul className="picker-matches">
            {matches.map((unit) => (
              <li key={unit.name}>
                <button type="button" onClick={() => addUnit(unit.name)}>
                  <span className={`cost-dot cost-${unit.cost}`}>{unit.cost}</span>
                  {unit.name}
                  <span className="traits">{unit.traits.join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {heldUnits.length > 0 ? (
          <ul className="held-chips">
            {heldUnits.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => removeUnit(name)}
                  title={`Remove ${name}`}
                >
                  {name} ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No Holdings yet, Comps are in Tier order.</p>
        )}
      </section>

      <section className="holdings">
        <h2>Your items</h2>
        <input
          type="search"
          className="picker-search"
          placeholder="Search components and items…"
          value={itemSearch}
          onChange={(event) => setItemSearch(event.target.value)}
        />
        {itemMatches.length > 0 && (
          <ul className="picker-matches">
            {itemMatches.map((choice) => (
              <li key={`${choice.kind}-${choice.name}`}>
                <button type="button" onClick={() => addItem(choice.name)}>
                  {choice.name}
                  <span className="traits">{choice.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {heldItems.length > 0 && (
          <ul className="held-chips">
            {heldItems.map((name, index) => (
              <li key={`${name}-${index}`}>
                <button
                  type="button"
                  onClick={() => removeItemAt(index)}
                  title={`Remove ${name}`}
                >
                  {name} ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ol className="comp-list">
        {comps.comps.map((comp) => (
          <li key={comp.id} className="comp">
            <div className="comp-header">
              <span className={`tier tier-${comp.tier.toLowerCase()}`}>{comp.tier}</span>
              <h2>{comp.name}</h2>
              <span className="fit-score">Fit {comp.fit.score}</span>
            </div>
            <ul className="board">
              {comp.board.map((slot) => (
                <li
                  key={slot.unit}
                  className={`slot cost-${slot.cost} ${
                    comp.fit.heldUnits.includes(slot.unit) ? "held" : "missing"
                  }`}
                >
                  <span className="unit">{slot.unit}</span>
                  {slot.items.length > 0 && (
                    <span className="items">{slot.items.join(", ")}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="fit-reason">{comp.fit.reason}</p>
            <p className="priorities">
              Items:{" "}
              {comp.itemPriorities.map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className={`priority ${priorityState(item, comp.fit)}`}
                >
                  {item}
                </span>
              ))}
            </p>
          </li>
        ))}
      </ol>
    </main>
  );
}
