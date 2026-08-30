export type Tier = "S" | "A" | "B" | "C" | "D";

export interface BoardSlot {
  unit: string;
  cost: number;
  items: string[];
}

export interface Comp {
  id: string;
  name: string;
  tier: Tier;
  board: BoardSlot[];
  itemPriorities: string[];
  // Augments the source reports as synergizing with this Comp. Absent while
  // the source publishes no augment stats (MetaTFT's top_augments is empty
  // as of patch 18.1); augment Fit turns itself on when this fills.
  augments?: string[];
}

export interface CompFit {
  score: number;
  heldUnits: string[];
  missingUnits: string[];
  heldItems: string[];
  partialItems: string[];
  missingItems: string[];
  matchedAugments: string[];
  reason: string;
}

export interface RankedComp extends Comp {
  fit: CompFit;
}

export interface SetUnit {
  name: string;
  cost: number;
  traits: string[];
}

export interface SetItem {
  name: string;
  components: string[];
}

export interface SetAugment {
  name: string;
  traits: string[];
}

export interface SetDataResponse {
  patch: string;
  setNumber: number;
  setName: string;
  units: SetUnit[];
  items: SetItem[];
  augments?: SetAugment[];
}

export interface CompsResponse {
  patch: string;
  refreshedAt: string;
  comps: RankedComp[];
}
