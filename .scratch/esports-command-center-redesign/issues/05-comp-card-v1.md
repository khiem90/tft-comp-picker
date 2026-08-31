# 05: Comp card v1

**What to build:** Each Comp renders as a ranked card: rank badge, name, color-coded Tier chip, Fit as a percentage, trait chips with icons and true breakpoint counts, a Playstyle chip, and the existing Fit Explanation. Server-side: Fit percentage is the Comp's score for the player's Holdings divided by that Comp's full-match score (scoring and ranking unchanged); trait breakpoints decode MetaTFT's `traits_string` against CommunityDragon `minUnits` (trailing number is a 1-based breakpoint index; split on the last underscore; never tally from the unit list, which misses emblems); Playstyle passes through the `levelling` enum.

**Blocked by:** 04 (Icon assets end to end).

**Status:** ready-for-agent

- [ ] Cards show rank badge, name, Tier chip, Fit percentage, trait chips, Playstyle chip, Fit Explanation
- [ ] Fit percentage is server-computed; a full-match Holdings set yields 100% and ranking order is identical to before
- [ ] Trait chips show correct counts including emblem contributions (e.g. a comp with 3 on-board Fae plus an emblem shows "4 Fae")
- [ ] API-seam tests assert fit percentage, decoded trait breakpoints, and playstyle against the recorded fixtures
