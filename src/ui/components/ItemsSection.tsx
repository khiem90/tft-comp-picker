import type { SetItem } from "../../shared/types";

interface ItemChoice {
  name: string;
  kind: "component" | "item";
  hint: string;
}

// The picker offers raw components ahead of completed items; mid-game the
// player mostly holds components.
function itemChoices(items: SetItem[]): ItemChoice[] {
  const components = [...new Set(items.flatMap((item) => item.components))];
  return [
    ...components.map((name) => ({ name, kind: "component" as const, hint: "component" })),
    ...items.map((item) => ({
      name: item.name,
      kind: "item" as const,
      hint: item.components.join(" + "),
    })),
  ];
}

interface ItemsSectionProps {
  items: SetItem[];
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: (name: string) => void;
}

export function ItemsSection({ items, search, onSearchChange, onAdd }: ItemsSectionProps) {
  // Item Holdings are a multiset: two Giant's Belts are twice the credit, so
  // matches never exclude what is already held.
  const query = search.trim().toLowerCase();
  const matches = query
    ? itemChoices(items).filter((choice) => choice.name.toLowerCase().includes(query))
    : [];

  return (
    <section className="picker">
      <h2 className="eyebrow">Components and items</h2>
      <input
        type="search"
        className="picker-search"
        placeholder="Add a component or item…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      {matches.length > 0 && (
        <ul className="picker-matches">
          {matches.map((choice) => (
            <li key={`${choice.kind}-${choice.name}`}>
              <button type="button" onClick={() => onAdd(choice.name)}>
                {choice.name}
                <span className="traits">{choice.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
