import type { BoardSlot, RankedComp, Tier } from "../shared/types";

// Lanes run strongest to weakest, the order the meta source publishes.
export const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D"];

// One line per Tier under the lane letter: what the meta source's ranking
// means for the player, in the player's words.
export const TIER_WORD: Record<Tier, string> = {
  S: "top of the meta",
  A: "strong",
  B: "playable",
  C: "niche",
  D: "weak",
};

export function isHeld(comp: RankedComp, slot: BoardSlot): boolean {
  return comp.fit.heldUnits.includes(slot.unit);
}

// Board units the player does not hold, cheapest first: the shop order in
// which they can be bought.
export function missingSlots(comp: RankedComp): BoardSlot[] {
  return comp.board
    .filter((slot) => !isHeld(comp, slot))
    .sort((a, b) => a.cost - b.cost);
}

// Shop price of the missing units. A 1-cost costs 1 gold, a 5-cost 5, so
// the board cost of the units left to buy is the distance to the Comp in
// the currency the player is actually spending.
export function goldToBuy(comp: RankedComp): number {
  return missingSlots(comp).reduce((sum, slot) => sum + slot.cost, 0);
}

// Core Units resolve through their board slots: the slot carries the display
// name, cost, and build items. A core apiName with no slot cannot happen in
// server output but costs nothing to skip.
export function coreSlots(comp: RankedComp): BoardSlot[] {
  return (comp.coreUnits ?? []).flatMap((api) => {
    const slot = comp.board.find((candidate) => candidate.apiName === api);
    return slot ? [slot] : [];
  });
}

// The four portraits a lane tile shows: Core Units first, filler after, so
// the tile reads as the Comp's carries rather than its cheapest bodies.
export function mosaicSlots(comp: RankedComp): BoardSlot[] {
  const core = coreSlots(comp);
  const rest = comp.board.filter((slot) => !core.includes(slot));
  return [...core, ...rest].slice(0, 4);
}
