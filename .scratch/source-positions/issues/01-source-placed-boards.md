# 01: Source-placed boards with honest labels

**What to build:** After a Refresh, every Comp whose cluster has comp-details data renders its Board layout on the real most-played cells, and the card tells the truth about where the board came from. The details fetch runs inside the same Refresh as the cluster fetch, reusing its generation id. Placement walks the Comp's units in source order, giving each its highest-count cell still free, with the source's back-row-first cell numbering flipped to the app's front-is-row-0 convention. Summons and monsters in the details payload never reach the board. A unit without cell data, or a Comp whose details fetch fails, lands on the existing role-and-range heuristic without failing the Refresh. The served payload carries a per-Comp provenance marker, source-backed only when every unit was source-placed; the card drops the "derived from unit roles and range" caveat on source-backed boards and keeps it on heuristic ones. The Board layout glossary entry in CONTEXT.md is rewritten to cover both provenances.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Refresh fetches comp-details per cluster with the generation id already read for the cluster fetch
- [x] A live comp-details fixture is recorded beside the existing recorded fixtures
- [x] Units land on their top source cell with the row flip pinned in both directions
- [x] A cell conflict sends the later unit to its next most-played free cell; no two units share a hex
- [x] A unit absent from the cell data falls back to its heuristic line
- [x] A summon or monster in the details payload never appears on the board
- [x] A cluster whose details fetch fails serves a full heuristic board and the Refresh still succeeds
- [x] Payload carries a per-Comp layout provenance marker; source-backed only when every unit was source-placed
- [x] Card label switches on provenance: no caveat on source-backed boards, the existing suggested label on heuristic boards
- [x] CONTEXT.md's Board layout entry covers both provenances
- [x] All assertions live at the refresh seam against recorded fixtures

## Comments

Implemented at the refresh seam. The endpoint is
`GET https://api-hc.metatft.com/tft-comps-api/comp_details?comp=<clusterId>&cluster_id=<generation>`
(both params required; the generation comes from `results.data.cluster_id` of the comps payload).
Cell scheme verified live: `cell_1` is the player's back-left hex, `cell_28` front-right, so the
row flips to the app's front-is-row-0 grid. The recorded fixture is
`tests/fixtures/recorded/metatft-comp_details-422000.json`. A live end-to-end Refresh placed 51 of
53 clusters source-backed; the two heuristic ones are monster-heavy boards whose units lack cell
data, the intended fallback.
