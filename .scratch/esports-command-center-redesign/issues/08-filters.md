# 08: Filters

**What to build:** The right rail gains three working filter groups (Tier, Trait, Playstyle) plus a Clear All control. Each filter narrows the ranked comp list; combined filters intersect. Comp Origin, Cost, advanced options, and the tip card from the reference image stay cut per the spec.

**Blocked by:** 05 (Comp card v1).

**Status:** done

- [x] Tier, Trait, and Playstyle filters each narrow the comp list; ranking order within results is unchanged
- [x] Trait filter matches a Comp's decoded trait breakdown, not a naive unit tally
- [x] Clear All restores the unfiltered ranking in one click
- [x] An empty filter result shows an honest empty state, not a blank column

## Comments

Filtering is client-side view state in App, one single-select dropdown per
group like the mock; groups intersect. The pure logic (selection type, match
predicate, option derivation) lives in `src/ui/filters.ts`; markup in
`FiltersPanel`. Options derive from the ranked Comps themselves, so every
single choice matches at least one Comp and only combinations can come up
empty. Playstyle options follow the spec's order (lvl 5/6/7, Standard,
Fast 8, Fast 9).

Rank badges are assigned before filtering, so a filtered card keeps its true
position in the full ranking; renumbering would pass a mid-table Comp off as
the overall best. No UI tests, per the spec's testing decision that the HTTP
API stays the only seam.

Code review (Standards + Spec agents) findings, all but one acted on:

- Stale selections could outlive a Refresh that removed their option: the
  dropdown would display All while the filter kept excluding everything.
  `pruneFilters` now resets exactly the vanished groups when comps data
  changes.
- The three near-identical select blocks collapsed into one `FilterGroup`
  component, and `anyFilterActive` stopped enumerating fields, trimming the
  per-new-group edit surface the review flagged.
- A comment used invented "economy-plan" vocabulary; reworded to plain
  glossary terms.
- The empty state's own "Clear all filters" button is a deliberate second
  clear control beyond story 18's single rail control: the recovery belongs
  where the dead end is. Kept.
- Not acted on: `PLAYSTYLE_ORDER` re-lists the known enum values that
  `shared/types.ts` documents in a comment. The type keeps Playstyle a
  verbatim string on purpose, and unknown values degrade to an alphabetical
  tail, so the duplication only affects ordering niceness.
