# 05: Comp card v1

**What to build:** Each Comp renders as a ranked card: rank badge, name, color-coded Tier chip, Fit as a percentage, trait chips with icons and true breakpoint counts, a Playstyle chip, and the existing Fit Explanation. Server-side: Fit percentage is the Comp's score for the player's Holdings divided by that Comp's full-match score (scoring and ranking unchanged); trait breakpoints decode MetaTFT's `traits_string` against CommunityDragon `minUnits` (trailing number is a 1-based breakpoint index; split on the last underscore; never tally from the unit list, which misses emblems); Playstyle passes through the `levelling` enum.

**Blocked by:** 04 (Icon assets end to end).

**Status:** done

- [x] Cards show rank badge, name, Tier chip, Fit percentage, trait chips, Playstyle chip, Fit Explanation
- [x] Fit percentage is server-computed; a full-match Holdings set yields 100% and ranking order is identical to before
- [x] Trait chips show correct counts including emblem contributions (e.g. a comp with 3 on-board Fae plus an emblem shows "4 Fae")
- [x] API-seam tests assert fit percentage, decoded trait breakpoints, and playstyle against the recorded fixtures

## Comments

Done. Server side: `Comp` grew optional `traits` (new `CompTrait`: name,
apiName, count) and `playstyle`, both written by the transform and absent on
older disk data, which the UI tolerates. `decodeTraits` in
`src/server/sources.ts` splits each `traits_string` entry on its last
underscore, treats the trailing number as a 1-based index into the trait's
CommunityDragon `minUnits` ladder, and drops anything it cannot decode
honestly. That drop matters in practice: `DA_18_Eclipse`'s one recorded
breakpoint has `minUnits: null`, so Eclipse comps get no Eclipse chip rather
than an invented count, and a seam test pins that. Chips sort by count
descending. Playstyle is `levelling` verbatim; the recorded capture holds
exactly the six known values.

Fit percentage needed no new scoring: `fit.score` was already held pieces
over full-match pieces, times 100, capped. Two new seam tests prove a
full-match Holdings set scores 100 and ranks first, on both the hand
fixtures and the recorded ones. Ranking math untouched.

UI: `CompCard` renders rank badge (list position from `CompList`), name,
Tier chip, `Fit N%`, a trait-chip row (icon via `IconTile` keyed by trait
apiName from Set data, count, name) with the Playstyle chip at its end, and
the existing Fit Explanation. New CSS uses the token layer only.

Review findings applied: renamed a misleading `split` index variable,
made the `traits_string` split tolerant of comma spacing, and added the
Eclipse drop-not-fake test. Verified in the browser against a live Refresh:
cluster "Fae Rengar" shows 4 Fae from three on-board Fae plus Rengar's
emblem. Typecheck clean; 66 seam tests pass.
