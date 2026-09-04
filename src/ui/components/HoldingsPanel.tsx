import type { SetAugment, SetItem, SetUnit } from "../../shared/types";
import { AugmentsSection } from "./AugmentsSection";
import { ItemsSection } from "./ItemsSection";
import { UnitsSection } from "./UnitsSection";

interface HoldingsPanelProps {
  units: SetUnit[];
  items: SetItem[];
  augmentChoices: SetAugment[];
  augmentsUsable: boolean;
  heldUnits: string[];
  heldAugments: string[];
  search: string;
  itemSearch: string;
  augmentSearch: string;
  onSearchChange: (value: string) => void;
  onItemSearchChange: (value: string) => void;
  onAugmentSearchChange: (value: string) => void;
  onAddUnit: (name: string) => void;
  onAddItem: (name: string) => void;
  onAddAugment: (name: string) => void;
}

// The picker row under the top bar: one search per Holdings kind. Held
// entries are not repeated here; the chips in the top bar are the one place
// they show and the one place they are removed.
export function HoldingsPanel({
  units,
  items,
  augmentChoices,
  augmentsUsable,
  heldUnits,
  heldAugments,
  search,
  itemSearch,
  augmentSearch,
  onSearchChange,
  onItemSearchChange,
  onAugmentSearchChange,
  onAddUnit,
  onAddItem,
  onAddAugment,
}: HoldingsPanelProps) {
  return (
    <div className="holdings-panel" id="holdings-panel">
      <UnitsSection
        units={units}
        held={heldUnits}
        search={search}
        onSearchChange={onSearchChange}
        onAdd={onAddUnit}
      />
      <ItemsSection
        items={items}
        search={itemSearch}
        onSearchChange={onItemSearchChange}
        onAdd={onAddItem}
      />
      {augmentsUsable && (
        <AugmentsSection
          choices={augmentChoices}
          held={heldAugments}
          search={augmentSearch}
          onSearchChange={onAugmentSearchChange}
          onAdd={onAddAugment}
        />
      )}
    </div>
  );
}
