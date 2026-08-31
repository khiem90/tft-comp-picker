# 01: Source-placed boards with honest labels

**What to build:** After a Refresh, every Comp whose cluster has comp-details data renders its Board layout on the real most-played cells, and the card tells the truth about where the board came from. The details fetch runs inside the same Refresh as the cluster fetch, reusing its generation id. Placement walks the Comp's units in source order, giving each its highest-count cell still free, with the source's back-row-first cell numbering flipped to the app's front-is-row-0 convention. Summons and monsters in the details payload never reach the board. A unit without cell data, or a Comp whose details fetch fails, lands on the existing role-and-range heuristic without failing the Refresh. The served payload carries a per-Comp provenance marker, source-backed only when every unit was source-placed; the card drops the "derived from unit roles and range" caveat on source-backed boards and keeps it on heuristic ones. The Board layout glossary entry in CONTEXT.md is rewritten to cover both provenances.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Refresh fetches comp-details per cluster with the generation id already read for the cluster fetch
- [ ] A live comp-details fixture is recorded beside the existing recorded fixtures
- [ ] Units land on their top source cell with the row flip pinned in both directions
- [ ] A cell conflict sends the later unit to its next most-played free cell; no two units share a hex
- [ ] A unit absent from the cell data falls back to its heuristic line
- [ ] A summon or monster in the details payload never appears on the board
- [ ] A cluster whose details fetch fails serves a full heuristic board and the Refresh still succeeds
- [ ] Payload carries a per-Comp layout provenance marker; source-backed only when every unit was source-placed
- [ ] Card label switches on provenance: no caveat on source-backed boards, the existing suggested label on heuristic boards
- [ ] CONTEXT.md's Board layout entry covers both provenances
- [ ] All assertions live at the refresh seam against recorded fixtures
