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
}

export interface CompFit {
  score: number;
  heldUnits: string[];
  missingUnits: string[];
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

export interface SetDataResponse {
  patch: string;
  setNumber: number;
  setName: string;
  units: SetUnit[];
}

export interface CompsResponse {
  patch: string;
  refreshedAt: string;
  comps: RankedComp[];
}
