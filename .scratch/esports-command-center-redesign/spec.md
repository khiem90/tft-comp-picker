# Esports Command Center Redesign

Status: ready-for-agent

Reference design: `output/redesigns/01-esports-command-center.png`

## Problem Statement

The app works but reads like a debug page. Mid-game, the player has seconds to decide which Comp to pivot toward, and today every unit, item, and trait is a bare text string in a flat vertical list. Nothing is scannable at a glance: no portraits, no icons, no visual ranking cues. The player picked the "esports command center" direction from the generated redesign candidates and wants the app to look and behave like that mock, as closely as the real data allows.

## Solution

Rebuild the UI as the three-column dashboard in the reference image, with every element backed by real or honestly derived data. The left sidebar shows Holdings with unit portraits, item icons, and counts. The center column shows ranked Comp cards with a Tier chip, Fit as a percentage, trait chips with true breakpoint counts, a suggested hex Board layout, a Core Units strip with builds and Star targets, and the Fit Explanation. The right rail shows Patch and Refresh status plus working filters for Tier, Trait, and Playstyle. Icons are downloaded locally once per Patch as part of Refresh, so the app keeps working offline mid-game. Anything in the mock the data cannot support honestly is cut rather than faked.

## User Stories

1. As a player, I want Comps shown as ranked cards with prominent rank badges, so that the best pivot is the first thing I see.
2. As a player, I want Fit displayed as a percentage of a Comp's full-match score, so that I can read instantly how close my Holdings are to complete.
3. As a player, I want each Comp's Tier shown as a color-coded chip, so that I can weigh meta strength against Fit at a glance.
4. As a player, I want each Comp's trait breakpoints shown as chips with real counts (e.g. "6 Sentinel"), so that I know which traits the Comp actually activates, including emblem contributions.
5. As a player, I want a suggested hex Board layout per Comp with frontline and backline derived from unit roles, so that I get a starting placement without pretending it came from match data.
6. As a player, I want the Board layout visibly marked as suggested, so that I never mistake a local heuristic for sourced positioning.
7. As a player, I want Star targets marked on a Comp's units, so that I know which units are worth rolling to 3-star.
8. As a player, I want a Core Units strip on each card showing the item-carrying units with their builds, so that I can see who needs items without reading the whole board.
9. As a player, I want the Fit Explanation sentence kept on each card, so that I understand why a Comp ranks where it does.
10. As a player, I want my held units shown as portraits with cost-colored frames, so that my bench reads the way the game client reads.
11. As a player, I want my held items shown as icons with count badges, so that duplicate components are one tile instead of repeated text.
12. As a player, I want search inputs in each Holdings section, so that adding a unit or item takes one keystroke burst mid-round.
13. As a player, I want to remove any Holding with one click, so that correcting a mis-add is instant.
14. As a player, I want the augment section to stay hidden while the source provides no augment data, so that the UI never shows an empty dead section.
15. As a player, I want to filter Comps by Tier, so that I can hide off-meta options.
16. As a player, I want to filter Comps by Trait, so that I can pivot around an emblem or opener I'm committed to.
17. As a player, I want to filter Comps by Playstyle, so that I can match my economy plan (reroll levels, Standard, Fast 8, Fast 9).
18. As a player, I want a single control to clear all filters, so that I can get back to the full ranking instantly.
19. As a player, I want the current Patch and last Refresh time visible in the right rail, so that I can trust the recommendations are current.
20. As a player, I want the existing staleness and degraded-mode banners preserved in the new chrome, so that source failures stay visible instead of silent.
21. As a player, I want the New Game button kept in the top bar, so that resetting Holdings for a fresh game stays one click.
22. As a player, I want icons downloaded to local files during Refresh, so that the app renders fully offline mid-game and never hotlinks a third-party CDN at render time.
23. As a player, I want a neutral fallback tile wherever an icon is missing or was an upstream placeholder, so that a bad asset never breaks a card.
24. As a player, I want the dashboard laid out for a desktop monitor with sidebars that stack below a width threshold, so that the app is usable next to the game client and in a narrower window.
25. As a player, I want chrome with no feature behind it removed (Guide, Settings, dead filters, tip card), so that everything on screen is clickable for a reason.
26. As a player, I want the Comp ranking math left untouched, so that the redesign changes how recommendations look, never what they are.

## Implementation Decisions

- The source transform starts preserving fields it currently discards. Units, items, and traits keep their CommunityDragon `apiName` alongside display names, since `apiName` is the join key for both icon paths and MetaTFT's trait strings.
- Trait breakpoints come from MetaTFT's `traits_string`, decoded against CommunityDragon trait `effects.minUnits` (the trailing number is a 1-based breakpoint index, not a unit count). Parse by splitting on the last underscore, because apiNames themselves contain underscores and digits. Never derive trait counts from the unit list alone; `traits_string` accounts for emblems and a naive tally does not.
- Playstyle is MetaTFT's `levelling` enum passed through verbatim (six values: Fast 8, Fast 9, lvl 5, lvl 6, lvl 7, Standard).
- Star targets are MetaTFT's `stars` list intersected with the Comp's own board, with unresolvable names dropped. The raw list includes stray units from cluster classification and must not be rendered unfiltered.
- Core Units come from MetaTFT's `builds` (four per Comp), each with its build items. Units in `builds` are the item holders; everything else on the board is filler.
- Board layout is derived server-side from CommunityDragon's champion `role` field: tank/bruiser roles on front rows, carries and casters on the back row. Server-side derivation keeps it inside the tested seam and out of React.
- Fit is displayed as a percentage: the Comp's score for the player's Holdings divided by that Comp's full-match score. Scoring and ranking behavior are unchanged; this is presentation-layer normalization computed server-side.
- Refresh downloads icons (unit square tiles, trait icons, item and component icons; roughly 130 PNGs) to local files, keyed by `apiName`, alongside the JSON it already writes. The URL scheme is CommunityDragon's game path with the `.tex` extension swapped for `.png` (verified live against all four asset types). Augment icons are skipped until the source returns augment data.
- Icons are Set data: a Patch change stales them, and Refresh replaces them, consistent with the existing Stale semantics.
- Known upstream placeholder icon paths exist (e.g. `missing-t2`), so the UI renders a fallback tile for any icon that is absent or fails to load.
- The API contract grows: the comps payload adds trait breakdowns, Playstyle, Star targets, Core Units, Board layout, and Fit percentage; the set-data payload adds `apiName` and icon references. Existing fields are not renamed or removed.
- Filters are Tier, Trait, and Playstyle only. Comp Origin has no backing data and Cost has no meaning for filtering Comps; both are cut, as are the advanced-options row and the tip card.
- Top bar keeps the logo/title and New Game. Guide and Settings are cut; no stub chrome.
- The single-component UI is split into components, and a CSS custom-property token layer replaces the hardcoded hex values (palette, tier colors, cost colors, spacing, type scale) before any new styling is written.
- Desktop-first layout with one breakpoint below which the sidebars stack. No mobile design.
- The augment Holdings section keeps its current self-hiding behavior.
- Existing behaviors carry over untouched: Active game persistence, 24-hour Refresh trigger, degraded mode, patch-change banners, atomic data writes.

## Testing Decisions

- A good test asserts external behavior at the HTTP boundary: what the API returns and what files Refresh leaves on disk, never internal function shapes or React output.
- The repo's single seam stays its only seam: supertest against the Express app with source fetching stubbed by the recorded fixtures. All new derived data (trait breakdowns, Playstyle, Star targets, Core Units, Board layout, Fit percentage) is asserted through the comps and set-data endpoints against fixture expectations.
- Icon downloading is tested through the existing refresh seam, with the stubbed fetcher extended to serve fake icon bytes; tests assert the files land where the payload says they are and that a failed icon fetch degrades without failing the Refresh.
- Prior art: `tests/api.test.ts` (endpoint payload assertions), `tests/refresh.test.ts` (stubbed-source refresh flow), `tests/staleness.test.ts` (staleness reactions). New tests follow their structure and fixtures.
- The UI remains untested, as today. No component tests, no snapshot tests, no new tooling.

## Out of Scope

- Mobile design and the other four redesign directions.
- Guide and Settings features in any form.
- Stat enrichment beyond the mock: average placement, pick-rate sparklines, trend deltas, difficulty scores, placement histograms. The pipeline work makes these cheap follow-ups, but they are not in this spec.
- Augment icons and any augment-dependent card elements while the source returns no augment data.
- Champion splash art; only square tiles are used.
- Any change to Fit scoring, Tier derivation, or ranking order.
- Game history or multi-game tracking.
- UI-level automated tests.

## Further Notes

- The `.tex` to `.png` URL substitution on `raw.communitydragon.org/latest/game/` was verified live (HTTP 200, `image/png`) for a unit tile, item icon, trait icon, and component icon.
- MetaTFT provides no board position data of any kind; that fact is recorded in the glossary's Board layout entry so nobody goes hunting for it again.
- MetaTFT's `top_augments` is empty across all 53 clusters in the current capture, which is why augment elements stay conditional.
- Glossary terms for this feature (Playstyle, Core Units, Star target, Board layout, icons as Set data) were added to `CONTEXT.md` during the grilling session that produced this spec.
