import type { Tier } from "../../shared/types";
import type { FilterOptions, FilterSelection } from "../filters";
import { anyFilterActive, EMPTY_FILTERS } from "../filters";

// One filter group: a labeled dropdown whose empty value means "All", the
// group's off state. onChange gets the selected option value, or null for
// All.
function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="filter-group">
      <span className="filter-label">{label}</span>
      <select
        className="filter-select"
        value={value}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface FiltersPanelProps {
  options: FilterOptions;
  selection: FilterSelection;
  onSelectionChange: (selection: FilterSelection) => void;
}

// The filter bar above the lanes, one dropdown per group. Tier narrows the
// page to one lane; Trait and Playstyle thin every lane. Clear all resets
// every group at once.
export function FiltersPanel({ options, selection, onSelectionChange }: FiltersPanelProps) {
  return (
    <div className="filters-bar">
      <span className="eyebrow">Show</span>
      <FilterGroup
        label="Tier"
        value={selection.tier ?? ""}
        options={options.tiers.map((tier) => ({ value: tier, label: tier }))}
        onChange={(tier) => onSelectionChange({ ...selection, tier: tier as Tier | null })}
      />
      <FilterGroup
        label="Trait"
        value={selection.trait ?? ""}
        options={options.traits.map((trait) => ({ value: trait.apiName, label: trait.name }))}
        onChange={(trait) => onSelectionChange({ ...selection, trait })}
      />
      <FilterGroup
        label="Playstyle"
        value={selection.playstyle ?? ""}
        options={options.playstyles.map((playstyle) => ({ value: playstyle, label: playstyle }))}
        onChange={(playstyle) => onSelectionChange({ ...selection, playstyle })}
      />
      <button
        type="button"
        className="link-button"
        onClick={() => onSelectionChange(EMPTY_FILTERS)}
        disabled={!anyFilterActive(selection)}
      >
        Clear all
      </button>
    </div>
  );
}
