# Source-backed Board layouts

Status: ready-for-agent

## Problem Statement

Every Comp card shows a Board layout, but it is a local guess: tanks and bruisers on the front rows, everyone else on the back, filled center-out. Real comps are not positioned that way. Carries tuck into corners, tank clumps sit off-center, secondary frontline hangs a row back. The player looks at the suggested board, knows it is wrong, and has to alt-tab to a meta site to see where the units actually go. The layout should show how the comp is actually played, not a plausible-looking default.

## Solution

The meta source has the data after all, on an endpoint the app does not call yet. Its comp-details endpoint reports, for every unit in a cluster, which cells that unit stood on across real games, ranked by play count. During Refresh the app fetches this per cluster and builds each Comp's Board layout the same way the meta source's own site does: walk the Comp's units in source order, place each on its most-played cell that is still free. Units the data does not cover keep the current role-and-range heuristic, as does any Comp whose details fetch fails. The card label tells the two apart, so a source-backed board no longer carries the "derived from unit roles and range" caveat and a heuristic board still does.

## User Stories

1. As a player, I want each Comp's Board layout to show where the units are actually played, so that I can copy the placement without checking a meta site mid-game.
2. As a player, I want the board to match what the meta source's own site displays for that comp, so that the app and my usual reference never disagree.
3. As a player, I want carries placed on their real cells, corners included, so that the layout reflects positioning craft instead of a generic back row.
4. As a player, I want a Comp with no source cell data to keep the current suggested layout, so that every card still shows a board.
5. As a player, I want source-backed boards and suggested boards labeled differently, so that I know when a placement is real data and when it is a guess.
6. As a player, I want the board orientation to match the in-game view of my own half, so that I can mirror the layout without mentally flipping rows.
7. As a player, I want two units never sharing a hex, so that the board is always physically placeable.
8. As a player, I want the Comp's unit list unchanged by cell data, so that a stray unit in the source's statistics never adds or removes a unit from the board.
9. As a player, I want item icons and Star target marks to stay on the placed units, so that the richer layout loses nothing the board already showed.
10. As a player, I want cell data fetched during the same Refresh as Comps, so that positions and units always describe the same patch and cluster generation.
11. As a player, I want a failed details fetch for one cluster to leave that Comp on the heuristic board, so that a partial source outage never empties the comp list.
12. As a player, I want the app to keep serving last good boards when the source is unreachable, so that mid-game the layout works offline like everything else.

## Implementation Decisions

- The meta source's comp-details endpoint is the position source. It is keyed by the same cluster ids as the existing comps payload and names units by the same apiNames as Set data, so no new matching layer exists. Cluster ids rotate with the source's generation counter, so the details fetch must run inside the same Refresh that fetched the clusters.
- Cell data is statistical, the mode of real games, not an authored board. The placement rule is the one the source's own site uses: iterate the Comp's units in source order, assign each unit its highest-count cell not already taken. A unit with no cell data, or whose cells are all taken, falls to the existing role-and-range heuristic within its line.
- The source counts cells from the player's back row; the app's Board layout counts row 0 as the front. The fetcher flips rows when mapping cells to hex positions, and a test pins the flip in both directions.
- The details payload lists every unit ever seen in the cluster's games, including summons and monsters. The Comp's own board is the authoritative unit list; cell data is looked up per board unit and everything else in the payload is ignored.
- Each Comp in the served payload carries a layout provenance marker distinguishing source-backed from heuristic boards. The card reads it to choose between no caveat and the existing "derived from unit roles and range" label. Provenance is per Comp, not per unit; a board with any heuristic-placed unit is labeled heuristic.
- Positions are an attribute of a Comp with no lifecycle of their own. They ride the existing Refresh trigger, staleness rules, and degraded mode unchanged.
- The heuristic itself does not change. It remains the fallback for uncovered units and failed fetches, exactly as it stands.
- Fetch volume is roughly 260 KB per cluster, about 14 MB per Refresh across the current cluster count, acceptable at the daily cadence.
- The Board layout glossary entry currently states the meta source has no positions. That was true of the endpoints recon'd for the MVP and is false of the details endpoint, so the entry is rewritten when this lands to cover both provenances.
- ADR-0003 records the choice of statistical positions from the existing source over a second site's curated boards.

## Testing Decisions

- All tests live at the existing refresh seam: stub the source fetchers with recorded fixtures, run a Refresh, assert on the served comps payload. No new seams and no UI-level harness. The label switch is pinned by asserting the provenance marker at the seam.
- A recorded comp-details fixture joins the existing recorded fixtures. Record it from the live endpoint during implementation so tests read true payloads, matching how the other fixtures were made.
- Behaviors to pin: a unit lands on its top source cell with the row flip applied; a cell conflict sends the later unit to its next cell; no two units share a hex; a unit absent from the cell data falls to its heuristic line; a cluster whose details fetch fails serves a full heuristic board with heuristic provenance; a summon or monster in the details payload never reaches the board; provenance reads source-backed only when every unit was source-placed.
- Prior art is the existing Board layout test block in the refresh suite, including its synthetic-payload technique for forcing both directions of a rule.
- Good tests here assert served payload shapes and positions, never the internals of the placement walk.

## Out of Scope

- Opponent-aware or situational boards. The target is the comp's standard board only.
- Any influence of Holdings on the layout.
- Improving the fallback heuristic. It stays the current front/back split.
- The second site's curated boards as a middle fallback tier. Viable per the recon (fetchable JSON, same apiNames, hand-placed hexes) but it costs a decoder for an unstable internal format plus fuzzy comp matching. Revisit only if source coverage disappoints.
- Early-game boards. The sources carry them, the card does not show them.
- Lazy per-card fetching. Positions load with Refresh or not at all.

## Further Notes

- The comp-details endpoint also carries per-comp augments, counters, leveling, and unit stats. The augment data is interesting because the MVP recon found the comps payload's augment field permanently empty; a future feature could fill that gap from this endpoint.
- The endpoint needs the source's current generation id, which the source serves separately. The fetcher should read the generation from the same place the cluster fetch does rather than fetching it twice.
