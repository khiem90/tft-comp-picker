import type { SetUnit } from "../../shared/types";

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
        <ul className="held-chips">
          {held.map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => onRemove(name)}
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
  );
}
