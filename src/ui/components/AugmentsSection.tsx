import type { SetAugment } from "../../shared/types";

interface AugmentsSectionProps {
  choices: SetAugment[];
  // The caller derives this from the catalog and the Comps payload (see App).
  canMoveRanking: boolean;
  held: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}

export function AugmentsSection({
  choices,
  canMoveRanking,
  held,
  search,
  onSearchChange,
  onAdd,
  onRemove,
}: AugmentsSectionProps) {
  // Held chips keep the section alive even if the data disappears, so nothing
  // affects the query invisibly.
  if (!canMoveRanking && held.length === 0) return null;

  const query = search.trim().toLowerCase();
  const matches = query
    ? choices.filter(
        (augment) =>
          !held.includes(augment.name) &&
          augment.name.toLowerCase().includes(query),
      )
    : [];

  return (
    <section className="holdings">
      <h2>Your augments</h2>
      <input
        type="search"
        className="picker-search"
        placeholder="Search augments…"
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
      {held.length > 0 && (
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
      )}
    </section>
  );
}
