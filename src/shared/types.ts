export type Tier = "S" | "A" | "B" | "C" | "D";

// One hex of the 4x7 player half-board. row 0 is the front row (nearest the
// enemy), row 3 the back row; col 0 is the left edge.
export interface BoardHex {
  row: number;
  col: number;
}

// apiName is CommunityDragon's stable identifier, preserved everywhere a
// unit, item, or trait crosses the API: it is the join key for icon paths and
// for MetaTFT's trait strings, and item display names are not unique enough
// to join on (the recorded payload has 756 items behind 566 names).
export interface BoardSlot {
  unit: string;
  apiName: string;
  cost: number;
  items: string[];
  // Aligned index-for-index with items.
  itemApiNames: string[];
  // The Board layout hex this unit suggests standing on. Derived locally from
  // unit roles and attack range; the meta source has no position data, so the
  // UI must present it as suggested, never as sourced. Optional because data
  // files written before layout derivation existed lack it.
  position?: BoardHex;
}

// A trait a Comp activates, decoded from the meta source's trait string
// against Set data breakpoints. count is the true active count including
// emblems; a tally of the Comp's unit list would miss them.
export interface CompTrait {
  name: string;
  apiName: string;
  count: number;
}

export interface Comp {
  id: string;
  name: string;
  tier: Tier;
  // Optional because data files written before trait decoding and Playstyle
  // existed lack them; the UI must not assume either.
  traits?: CompTrait[];
  // The meta source's levelling enum verbatim. Known values: "Fast 8",
  // "Fast 9", "lvl 5", "lvl 6", "lvl 7", "Standard".
  playstyle?: string;
  board: BoardSlot[];
  // apiNames of this Comp's Core Units: the item-carrying units the meta
  // source marks in its builds (four per cluster, fewer after off-board
  // headliner variants are dropped), in the source's order. Their build
  // items ride on the matching board slots. Every other board unit is
  // filler. Optional because data files written before this field lack it.
  coreUnits?: string[];
  // apiNames of the Star targets: the meta source's stars list intersected
  // with this board. The raw list carries strays from cluster classification
  // and is never served unfiltered. Optional like coreUnits.
  starTargets?: string[];
  itemPriorities: string[];
  // Aligned index-for-index with itemPriorities.
  itemPriorityApiNames: string[];
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

// icon is a local URL under /icons, written by the Refresh that produced the
// payload. Absent when the download failed or upstream had only a placeholder;
// the UI renders a neutral fallback tile in that case. Never a CDN URL.
export interface SetUnit {
  name: string;
  apiName: string;
  cost: number;
  // Display names; join to SetTrait.name. MetaTFT speaks trait apiNames.
  traits: string[];
  icon?: string;
}

export interface SetItem {
  name: string;
  apiName: string;
  components: string[];
  // Aligned index-for-index with components.
  componentApiNames: string[];
  icon?: string;
}

// Both keys ship because the two sides of every trait join disagree: champion
// trait lists carry display names, MetaTFT's trait strings carry apiNames.
export interface SetTrait {
  name: string;
  apiName: string;
  icon?: string;
}

// A raw item component (Recurve Bow, B.F. Sword, ...). Listed on its own
// because Holdings hold components directly, and component icons have no
// other home in the payload.
export interface SetComponent {
  name: string;
  apiName: string;
  icon?: string;
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
  traits: SetTrait[];
  items: SetItem[];
  // Optional because data files written before icons existed lack it; the UI
  // must not assume it (issue 02's disk-served-data caveat).
  components?: SetComponent[];
  augments?: SetAugment[];
}

export interface TierMove {
  name: string;
  from: Tier;
  to: Tier;
}

// What a Patch-crossing Refresh changed, flagged to the player so a new meta
// gets noticed. Cleared by the next Refresh inside the same Patch.
export interface PatchChange {
  fromPatch: string;
  toPatch: string;
  addedComps: string[];
  removedComps: string[];
  tierMoves: TierMove[];
}

export interface CompsResponse {
  patch: string;
  refreshedAt: string;
  // Message of the most recent failed Refresh; null when the data on disk is
  // the last thing a Refresh produced. Non-null means rankings run on last
  // good data.
  refreshError: string | null;
  patchChange: PatchChange | null;
  comps: RankedComp[];
}
