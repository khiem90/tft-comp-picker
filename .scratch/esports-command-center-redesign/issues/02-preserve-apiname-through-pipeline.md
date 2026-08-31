# 02: Preserve apiName through the pipeline

**What to build:** The source transform stops discarding CommunityDragon's `apiName` for units, items, and traits. It flows through the shared types into both the comps and set-data API payloads, giving later slices the join key for icon paths and MetaTFT trait strings. Existing fields are not renamed or removed.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Set data payload carries `apiName` for every unit, item, and trait
- [x] Comps payload carries `apiName` on board slots and item references
- [x] Trait data is available keyed by both display name and apiName (MetaTFT speaks apiName, champion trait lists speak display names)
- [x] Fixture-backed API-seam tests assert apiName presence and correct joining
- [x] Existing payload consumers are unaffected

## Comments

Done. The transform in `src/server/sources.ts` now resolves item references to
`{name, apiName}` pairs and unzips them at the wire, so the new arrays
(`BoardSlot.apiName`/`itemApiNames`, `Comp.itemPriorityApiNames`,
`SetItem.apiName`/`componentApiNames`, `SetUnit.apiName`) stay aligned by
construction. Set data grows a `traits` catalog carrying both display name and
apiName; champion trait lists keep speaking display names. All fields are
additive; the recorded-fixture join is asserted at the refresh seam
(`tests/refresh.test.ts`, "apiName preservation") and hand-curated fixtures
were brought up to the new shape. Typecheck clean, 50 seam tests pass.

Two notes for slice 04:

- `itemPriorities` dedup stays keyed by display name (first apiName behind a
  name wins) so the visible list is unchanged; where CommunityDragon has two
  apiNames behind one display name, the surviving key is the first one MetaTFT
  listed for that Comp.
- Data files written before this change serve payloads without the new fields
  until the next Refresh (self-healing within 24h). Icon rendering must not
  assume `apiName` exists on disk-served data; the planned fallback tile
  covers that.
