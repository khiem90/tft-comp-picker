import type { SetUnit } from "../../shared/types";
import { IconTile } from "./IconTile";

export interface HeldItemChip {
  name: string;
  count: number;
  icon?: string;
}

interface AppHeaderProps {
  units: SetUnit[];
  heldUnits: string[];
  heldItems: HeldItemChip[];
  heldAugments: string[];
  onRemoveUnit: (name: string) => void;
  onRemoveItem: (name: string) => void;
  onRemoveAugment: (name: string) => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  patch: string;
  refreshedAt: string;
  refreshing: boolean;
  onRefresh: () => void;
  onNewGame: () => void;
}

// The top bar holds the whole Active game as chips, the way to add to it,
// and the trust signals: Patch, refreshed-at, and the manual Refresh. A chip
// removes its Holding on click, so removal never needs the picker open.
export function AppHeader({
  units,
  heldUnits,
  heldItems,
  heldAugments,
  onRemoveUnit,
  onRemoveItem,
  onRemoveAugment,
  panelOpen,
  onTogglePanel,
  patch,
  refreshedAt,
  refreshing,
  onRefresh,
  onNewGame,
}: AppHeaderProps) {
  const holdingsEmpty =
    heldUnits.length === 0 && heldItems.length === 0 && heldAugments.length === 0;
  return (
    <header className="top-bar">
      <h1 className="wordmark">Comp Picker</h1>

      <div className="holdings">
        <span className="eyebrow">You hold</span>
        {holdingsEmpty ? (
          <span className="holdings-hint">nothing yet, so Comps are in Tier order</span>
        ) : (
          <ul className="chips">
            {heldUnits.map((name) => {
              // A held name can predate the current Set data (stale Active
              // game); it still renders, on the fallback tile with no cost
              // rim, and stays removable.
              const unit = units.find((candidate) => candidate.name === name);
              return (
                <li key={`unit-${name}`}>
                  <button
                    type="button"
                    className={`chip portrait${unit ? ` cost-${unit.cost}` : ""}`}
                    onClick={() => onRemoveUnit(name)}
                    title={`Remove ${name}`}
                    aria-label={`Remove ${name}`}
                  >
                    <IconTile src={unit?.icon} label={name} />
                    <span className="chip-remove" aria-hidden="true">✕</span>
                  </button>
                </li>
              );
            })}
            {heldUnits.length > 0 && heldItems.length > 0 && <li className="chip-gap" />}
            {heldItems.map((item) => {
              const label =
                item.count > 1
                  ? `Remove one ${item.name} (holding ${item.count})`
                  : `Remove ${item.name}`;
              return (
                <li key={`item-${item.name}`}>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => onRemoveItem(item.name)}
                    title={label}
                    aria-label={label}
                  >
                    <IconTile src={item.icon} label={item.name} />
                    {item.count > 1 && <span className="chip-count">{item.count}</span>}
                    <span className="chip-remove" aria-hidden="true">✕</span>
                  </button>
                </li>
              );
            })}
            {heldAugments.map((name) => (
              <li key={`augment-${name}`}>
                <button
                  type="button"
                  className="chip chip-text"
                  onClick={() => onRemoveAugment(name)}
                  title={`Remove ${name}`}
                >
                  {name} ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className={`chip chip-add ${panelOpen ? "is-open" : ""}`}
          onClick={onTogglePanel}
          aria-expanded={panelOpen}
          aria-controls="holdings-panel"
          title={panelOpen ? "Hide the picker" : "Add units and items"}
        >
          {panelOpen ? "–" : "+"}
        </button>
      </div>

      <div className="trust">
        <span>
          Patch <b>{patch}</b>
        </span>
        <span className="trust-refreshed">
          refreshed {new Date(refreshedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
        </span>
        <button type="button" className="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        <button type="button" className="button is-solid" onClick={onNewGame}>
          New game
        </button>
      </div>
    </header>
  );
}
