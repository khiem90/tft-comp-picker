# 08: Staleness reactions

**What to build:** Refresh gets opinions about change. The three Stale rules from the spec: a Patch change triggers a full re-pull of Set data and Comps with what-changed flagged to the player; a Comp missing from the source is removed; a Comp that fell in Tier is kept but ranked down accordingly.

**Blocked by:** 07 (Refresh pipeline).

**Status:** done

- [x] A Refresh that detects a new Patch re-pulls both Comps and Set data and flags what changed in the UI
- [x] A Comp absent from the fresh source payload disappears from the list (covered by a seam test)
- [x] A Comp whose Tier fell is retained and its ranking drops, still able to rank high on strong Fit (covered by a seam test)
- [x] All three reactions are tested through the server HTTP API using fixture payload pairs (before/after) via the injected fetcher

## Comments

Implemented in `tests/staleness.test.ts` plus `patchChangeBetween` in `src/server/app.ts`. The diff matches Comps by name across the Patch boundary, not id: MetaTFT cluster ids are per-snapshot artifacts. The flag persists inside `comps.json` (`patchChange`) so it survives restarts, and the next same-Patch Refresh writes a file without it. Removal and Tier rank-down were already emergent from the full-overwrite Refresh; the seam tests pin them with before/after payload pairs through a sequenced fetcher.

One ranking note surfaced by the tests: a fallen C Comp with its full 7-unit board held ranks 4th of 53, behind S Comps holding 2 of the same units, because item priorities dilute the held fraction (7 of 19 pieces). Strong Fit still beats every Comp the player is uninvested in, which satisfies the spec's intent.
