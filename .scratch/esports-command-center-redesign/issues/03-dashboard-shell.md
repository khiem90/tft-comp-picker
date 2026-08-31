# 03: Dashboard shell

**What to build:** The app becomes the three-column command-center layout from the reference design: top bar with logo/title and New Game (Guide and Settings are cut, no stubs), Holdings rail on the left, comp list in the center, right rail with Patch number and last-Refresh status. Staleness, patch-change, and degraded-mode banners are restyled into the new chrome without behavior change. Below a width threshold the sidebars stack. Content inside the columns may still be the old text rendering; this slice is the frame.

**Blocked by:** 01 (Prefactor: component split + CSS token layer).

**Status:** done

- [x] Three-column desktop layout matching the reference design's structure
- [x] Top bar has logo/title and a working New Game button only
- [x] Right rail shows Patch and refreshed-at status
- [x] All existing banners (refresh error, degraded data, patch change) render in the new chrome and still trigger under the same conditions
- [x] Sidebars stack below the breakpoint; no horizontal page scroll
- [x] Existing API-seam tests pass untouched

## Comments

Done. `App.tsx` now renders a sticky top bar (brand + New Game, Guide and
Settings cut with no stubs), then a width-capped body: banners full width,
then a three-column grid (Holdings rail 300px, Comp column, status rail
280px). `AppHeader` shrank to the top bar; the new `StatusRail` shows Patch
and refreshed-at. The manual Refresh button moved from the old header into
the status rail, same handler, because the issue leaves the top bar to New
Game alone and the freshness line is where the mock puts the refresh control.
`StatusBanners` is untouched; only its CSS changed, so trigger conditions are
identical. Below 1100px the columns stack as Holdings, status, Comps: the
status rail is ordered above the Comp list so Patch and refreshed-at are not
buried under 50 cards.

Review findings applied: the center heading is "Top Comps", not the mock's
"Best Matches", because the glossary avoids "match" vocabulary;
`.header-button` became `.panel-button` and `.rail-title` became
`.column-title` after the layout made both names stale.

Verified in the browser: three columns on desktop, stacking at 900px with
scrollWidth equal to clientWidth, add-unit re-ranks, New Game clears
Holdings, no console errors. Typecheck clean; all 50 seam tests pass
untouched.
