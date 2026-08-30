# 03: Unit Fit tracer

**What to build:** The core loop, for units only. A fast searchable unit picker built from Set data lets the player enter the units they own; each entry re-sorts the Comp list live via the server's ranking endpoint. Ranking is Fit scaled by Tier, falling back to pure Tier order when Holdings are empty. Each Comp highlights held versus missing units and shows the reason behind its Fit score.

**Blocked by:** 01 (Walking skeleton).

**Status:** ready-for-agent

- [x] The unit picker is searchable, built from the Set data file, and adding or removing a unit takes one interaction each
- [x] Entering or removing a unit re-sorts the Comp list without a manual refresh
- [x] With empty Holdings, Comps appear in Tier order
- [x] A lower-Tier Comp with strong unit overlap ranks above a top-Tier Comp with none (covered by a seam test)
- [x] Every Comp stays visible; poor fits sink, nothing is hidden
- [x] Each Comp highlights which of its units the player holds versus which are missing
- [x] Each Comp shows its Fit score with a human-readable reason
- [x] Ranking behavior is tested through the server HTTP API only
