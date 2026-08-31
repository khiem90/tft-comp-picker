import type { SetUnit } from "../../shared/types";
import { IconTile } from "./IconTile";

interface UnitsSectionProps {
  units: SetUnit[];
  held: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}

export function UnitsSection({
  units,
  held,
  search,
  onSearchChange,
  onAdd,
  onRemove,
}: UnitsSectionProps) {
  const query = search.trim().toLowerCase();
  const matches = query
    ? units.filter(
        (unit) => !held.includes(unit.name) && unit.name.toLowerCase().includes(query),
      )
    : [];

  return (
    <section className="holdings">
      <h2>Your units</h2>
      <input
        type="search"
        className="picker-search"
        placeholder="Search units…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      {matches.length > 0 && (
        <ul className="picker-matches">
          {matches.map((unit) => (
            <li key={unit.name}>
              <button type="button" onClick={() => onAdd(unit.name)}>
                <span className={`cost-dot cost-${unit.cost}`}>{unit.cost}</span>
                {unit.name}
                <span className="traits">{unit.traits.join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {held.length > 0 ? (
        <ul className="held-tiles">
          {held.map((name) => {
            // A held name can predate the current Set data (stale Active
            // game); it still renders, on the fallback tile with no cost
            // frame, and stays removable.
            const unit = units.find((candidate) => candidate.name === name);
            return (
              <li key={name}>
                <button
                  type="button"
                  className={`holding-tile portrait${unit ? ` cost-frame-${unit.cost}` : ""}`}
                  onClick={() => onRemove(name)}
                  title={`Remove ${name}`}
                  aria-label={`Remove ${name}`}
                >
                  <IconTile src={unit?.icon} label={name} />
                  <span className="tile-remove" aria-hidden="true">
                    ✕
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="hint">No Holdings yet, Comps are in Tier order.</p>
      )}
    </section>
  );
}
