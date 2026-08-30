import { useEffect, useState } from "react";
import type { CompsResponse, SetDataResponse } from "../shared/types";

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`Server answered ${response.status}`);
    return response.json() as Promise<T>;
  });
}

function compsUrl(heldUnits: string[]): string {
  const params = new URLSearchParams();
  for (const unit of heldUnits) params.append("units", unit);
  const query = params.toString();
  return query ? `/api/comps?${query}` : "/api/comps";
}

export function App() {
  const [comps, setComps] = useState<CompsResponse | null>(null);
  const [setData, setSetData] = useState<SetDataResponse | null>(null);
  const [heldUnits, setHeldUnits] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<SetDataResponse>("/api/set-data")
      .then(setSetData)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  useEffect(() => {
    let superseded = false;
    fetchJson<CompsResponse>(compsUrl(heldUnits))
      .then((body) => {
        if (!superseded) setComps(body);
      })
      .catch((cause: Error) => {
        if (!superseded) setError(cause.message);
      });
    return () => {
      superseded = true;
    };
  }, [heldUnits]);

  if (error) return <p className="status">Could not load Comps: {error}</p>;
  if (!comps || !setData) return <p className="status">Loading Comps…</p>;

  const query = search.trim().toLowerCase();
  const matches = query
    ? setData.units.filter(
        (unit) =>
          !heldUnits.includes(unit.name) && unit.name.toLowerCase().includes(query),
      )
    : [];

  const addUnit = (name: string) => {
    setHeldUnits((held) => [...held, name]);
    setSearch("");
  };
  const removeUnit = (name: string) => {
    setHeldUnits((held) => held.filter((unit) => unit !== name));
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
          className="unit-search"
          placeholder="Search units…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {matches.length > 0 && (
          <ul className="unit-matches">
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
          <ul className="held-units">
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
              Items: {comp.itemPriorities.join(" → ")}
            </p>
          </li>
        ))}
      </ol>
    </main>
  );
}
