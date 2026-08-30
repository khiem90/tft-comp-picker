# 08: Staleness reactions

**What to build:** Refresh gets opinions about change. The three Stale rules from the spec: a Patch change triggers a full re-pull of Set data and Comps with what-changed flagged to the player; a Comp missing from the source is removed; a Comp that fell in Tier is kept but ranked down accordingly.

**Blocked by:** 07 (Refresh pipeline).

**Status:** ready-for-agent

- [ ] A Refresh that detects a new Patch re-pulls both Comps and Set data and flags what changed in the UI
- [ ] A Comp absent from the fresh source payload disappears from the list (covered by a seam test)
- [ ] A Comp whose Tier fell is retained and its ranking drops, still able to rank high on strong Fit (covered by a seam test)
- [ ] All three reactions are tested through the server HTTP API using fixture payload pairs (before/after) via the injected fetcher
