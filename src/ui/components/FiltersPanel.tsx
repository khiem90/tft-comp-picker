import type { Tier } from "../../shared/types";
import type { FilterOptions, FilterSelection } from "../filters";
import { anyFilterActive, EMPTY_FILTERS } from "../filters";

interface FiltersPanelProps {
  options: FilterOptions;
  selection: FilterSelection;
  onSelectionChange: (selection: FilterSelection) => void;
}

// Right-rail filter groups, one dropdown each like the mock. An empty select
// value means "All", the group's off state; Clear All resets every group.
export function FiltersPanel({
  options,
  selection,
  onSelectionChange,
}: FiltersPanelProps) {
  return (
    <div className="filters-panel">
      <div className="filters-header">
        <h2 className="filters-title">Filters</h2>
        <button
          type="button"
          className="clear-filters"
          onClick={() => onSelectionChange(EMPTY_FILTERS)}
          disabled={!anyFilterActive(selection)}
        >
          Clear All
        </button>
      </div>
      <label className="filter-group">
        <span className="filter-label">Tier</span>
        <select
          className="filter-select"
          value={selection.tier ?? ""}
          onChange={(event) =>
            onSelectionChange({
              ...selection,
              tier: (event.target.value || null) as Tier | null,
            })
          }
        >
          <option value="">All</option>
          {options.tiers.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-group">
        <span className="filter-label">Trait</span>
        <select
          className="filter-select"
          value={selection.trait ?? ""}
          onChange={(event) =>
            onSelectionChange({
              ...selection,
              trait: event.target.value || null,
            })
          }
        >
          <option value="">All</option>
          {options.traits.map((trait) => (
            <option key={trait.apiName} value={trait.apiName}>
              {trait.name}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-group">
        <span className="filter-label">Playstyle</span>
        <select
          className="filter-select"
          value={selection.playstyle ?? ""}
          onChange={(event) =>
            onSelectionChange({
              ...selection,
              playstyle: event.target.value || null,
            })
          }
        >
          <option value="">All</option>
          {options.playstyles.map((playstyle) => (
            <option key={playstyle} value={playstyle}>
              {playstyle}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
