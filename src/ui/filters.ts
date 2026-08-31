import type { RankedComp, Tier } from "../shared/types";

// One value per group; null means the group is off. Groups intersect: every
// active group must match for a Comp to stay visible.
export interface FilterSelection {
  tier: Tier | null;
  // A trait apiName. Matching goes through the Comp's decoded trait
  // breakdown, which counts emblems; a tally of the unit list would not.
  trait: string | null;
  playstyle: string | null;
}

export const EMPTY_FILTERS: FilterSelection = {
  tier: null,
  trait: null,
  playstyle: null,
};

export function anyFilterActive(selection: FilterSelection): boolean {
  return Object.values(selection).some((value) => value !== null);
}

export function matchesFilters(
  comp: RankedComp,
  selection: FilterSelection,
): boolean {
  if (selection.tier && comp.tier !== selection.tier) return false;
  if (
    selection.trait &&
    !(comp.traits ?? []).some((trait) => trait.apiName === selection.trait)
  ) {
    return false;
  }
  if (selection.playstyle && comp.playstyle !== selection.playstyle)
    return false;
  return true;
}

export interface TraitOption {
  apiName: string;
  name: string;
}

export interface FilterOptions {
  tiers: Tier[];
  traits: TraitOption[];
  playstyles: string[];
}

const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D"];

// The order the spec lists Playstyles in: low-level plans first, then
// Standard, Fast 8, Fast 9. Values outside the known enum sort after
// these, alphabetically.
const PLAYSTYLE_ORDER = ["lvl 5", "lvl 6", "lvl 7", "Standard", "Fast 8", "Fast 9"];

// Options come from the ranked Comps themselves, so any single choice
// matches at least one Comp; only combined groups can come up empty.
export function filterOptions(comps: RankedComp[]): FilterOptions {
  const tiers = TIER_ORDER.filter((tier) =>
    comps.some((comp) => comp.tier === tier),
  );

  const traitNames = new Map<string, string>();
  for (const comp of comps) {
    for (const trait of comp.traits ?? []) {
      traitNames.set(trait.apiName, trait.name);
    }
  }
  const traits = [...traitNames]
    .map(([apiName, name]) => ({ apiName, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const seen = new Set<string>();
  for (const comp of comps) {
    if (comp.playstyle) seen.add(comp.playstyle);
  }
  const playstyles = [
    ...PLAYSTYLE_ORDER.filter((playstyle) => seen.has(playstyle)),
    ...[...seen].filter((playstyle) => !PLAYSTYLE_ORDER.includes(playstyle)).sort(),
  ];

  return { tiers, traits, playstyles };
}

// A Refresh can drop a Tier, Trait, or Playstyle from the data. A selection
// pointing at a vanished option would keep excluding every Comp while its
// dropdown, finding no matching option, displays as All; resetting exactly
// the vanished groups keeps the dropdowns truthful. Returns the selection
// itself when nothing vanished, so callers can setState without churn.
export function pruneFilters(
  selection: FilterSelection,
  options: FilterOptions,
): FilterSelection {
  const pruned: FilterSelection = {
    tier:
      selection.tier && options.tiers.includes(selection.tier)
        ? selection.tier
        : null,
    trait:
      selection.trait &&
      options.traits.some((trait) => trait.apiName === selection.trait)
        ? selection.trait
        : null,
    playstyle:
      selection.playstyle && options.playstyles.includes(selection.playstyle)
        ? selection.playstyle
        : null,
  };
  const unchanged =
    pruned.tier === selection.tier &&
    pruned.trait === selection.trait &&
    pruned.playstyle === selection.playstyle;
  return unchanged ? selection : pruned;
}
