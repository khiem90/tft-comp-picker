# 03: Dashboard shell

**What to build:** The app becomes the three-column command-center layout from the reference design: top bar with logo/title and New Game (Guide and Settings are cut, no stubs), Holdings rail on the left, comp list in the center, right rail with Patch number and last-Refresh status. Staleness, patch-change, and degraded-mode banners are restyled into the new chrome without behavior change. Below a width threshold the sidebars stack. Content inside the columns may still be the old text rendering; this slice is the frame.

**Blocked by:** 01 (Prefactor: component split + CSS token layer).

**Status:** ready-for-agent

- [ ] Three-column desktop layout matching the reference design's structure
- [ ] Top bar has logo/title and a working New Game button only
- [ ] Right rail shows Patch and refreshed-at status
- [ ] All existing banners (refresh error, degraded data, patch change) render in the new chrome and still trigger under the same conditions
- [ ] Sidebars stack below the breakpoint; no horizontal page scroll
- [ ] Existing API-seam tests pass untouched
