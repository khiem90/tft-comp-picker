import type { SetUnit } from "../../shared/types";

interface UnitsSectionProps {
  units: SetUnit[];
  // Held units are excluded from matches; a unit is held once or not at all.
  held: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: (name: string) => void;
}

export function UnitsSection({ units, held, search, onSearchChange, onAdd }: UnitsSectionProps) {
  const query = search.trim().toLowerCase();
  const matches = query
    ? units.filter(
        (unit) => !held.includes(unit.name) && unit.name.toLowerCase().includes(query),
      )
    : [];

  return (
    <section className="picker">
      <h2 className="eyebrow">Units</h2>
      <input
        type="search"
        className="picker-search"
        placeholder="Add a unit…"
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
    </section>
  );
}
