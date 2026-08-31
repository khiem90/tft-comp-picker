import type { SetComponent, SetItem } from "../../shared/types";
import { IconTile } from "./IconTile";

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
  // Absent on data written before icons existed; then every tile falls back.
  components?: SetComponent[];
  held: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: (name: string) => void;
  onRemoveAt: (index: number) => void;
}

export function ItemsSection({
  items,
  components,
  held,
  search,
  onSearchChange,
  onAdd,
  onRemoveAt,
}: ItemsSectionProps) {
  // Item Holdings are a multiset: two Giant's Belts are twice the credit, so
  // matches never exclude what is already held and removal takes one copy.
  const query = search.trim().toLowerCase();
  const matches = query
    ? itemChoices(items).filter((choice) =>
        choice.name.toLowerCase().includes(query),
      )
    : [];

  // Held names can be components or completed items; one map answers both.
  const iconByName = new Map<string, string | undefined>();
  for (const component of components ?? []) iconByName.set(component.name, component.icon);
  for (const item of items) iconByName.set(item.name, item.icon);

  // Duplicates collapse to one tile with a count badge, in first-added order.
  const heldCounts = new Map<string, number>();
  for (const name of held) heldCounts.set(name, (heldCounts.get(name) ?? 0) + 1);

  return (
    <section className="holdings">
      <h2>Your items</h2>
      <input
        type="search"
        className="picker-search"
        placeholder="Search components and items…"
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
      {held.length > 0 && (
        <ul className="held-tiles">
          {[...heldCounts].map(([name, count]) => {
            const removeLabel =
              count > 1 ? `Remove one ${name} (holding ${count})` : `Remove ${name}`;
            return (
              <li key={name}>
                <button
                  type="button"
                  className="holding-tile"
                  onClick={() => onRemoveAt(held.lastIndexOf(name))}
                  title={removeLabel}
                  aria-label={removeLabel}
                >
                  <IconTile src={iconByName.get(name)} label={name} />
                  {count > 1 && <span className="tile-count">{count}</span>}
                  <span className="tile-remove" aria-hidden="true">
                    ✕
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
