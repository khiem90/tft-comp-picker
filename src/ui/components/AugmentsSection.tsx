import type { SetAugment } from "../../shared/types";

interface AugmentsSectionProps {
  choices: SetAugment[];
  held: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: (name: string) => void;
}

// Rendered only while augments can move a ranking (the caller decides from
// the catalog and the Comps payload). Held augments live in the top bar
// chips, so a picker that cannot change anything simply stays away.
export function AugmentsSection({
  choices,
  held,
  search,
  onSearchChange,
  onAdd,
}: AugmentsSectionProps) {
  const query = search.trim().toLowerCase();
  const matches = query
    ? choices.filter(
        (augment) =>
          !held.includes(augment.name) && augment.name.toLowerCase().includes(query),
      )
    : [];

  return (
    <section className="picker">
      <h2 className="eyebrow">Augments</h2>
      <input
        type="search"
        className="picker-search"
        placeholder="Add an augment…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      {matches.length > 0 && (
        <ul className="picker-matches">
          {matches.map((augment) => (
            <li key={augment.name}>
              <button type="button" onClick={() => onAdd(augment.name)}>
                {augment.name}
                <span className="traits">{augment.traits.join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
