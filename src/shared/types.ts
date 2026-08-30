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

export interface CompsResponse {
  patch: string;
  refreshedAt: string;
  comps: Comp[];
}
