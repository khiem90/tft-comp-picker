# 02: Preserve apiName through the pipeline

**What to build:** The source transform stops discarding CommunityDragon's `apiName` for units, items, and traits. It flows through the shared types into both the comps and set-data API payloads, giving later slices the join key for icon paths and MetaTFT trait strings. Existing fields are not renamed or removed.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Set data payload carries `apiName` for every unit, item, and trait
- [ ] Comps payload carries `apiName` on board slots and item references
- [ ] Trait data is available keyed by both display name and apiName (MetaTFT speaks apiName, champion trait lists speak display names)
- [ ] Fixture-backed API-seam tests assert apiName presence and correct joining
- [ ] Existing payload consumers are unaffected
