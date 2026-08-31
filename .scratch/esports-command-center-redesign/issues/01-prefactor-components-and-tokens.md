# 01: Prefactor: component split + CSS token layer

**What to build:** The app looks and behaves exactly as it does today, but the single UI component is split into focused components and every hardcoded color, spacing, and type value moves into a CSS custom-property token layer (palette, tier colors, cost colors, spacing, type scale). This makes every later redesign slice an easy change.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] The UI is composed of separate components (header, Holdings sections, comp list/card, status banners) instead of one monolith
- [x] All colors, spacing, and type values are CSS custom properties; no repeated hex literals in rules
- [x] Visual output and behavior are unchanged
- [x] The existing API-seam test suite passes untouched

## Comments

Done. `App.tsx` keeps state, fetching, and persistence; the view is now
`components/` (AppHeader, StatusBanners, UnitsSection, ItemsSection,
AugmentsSection, CompList, CompCard) with byte-identical DOM output.
`styles.css` gets a `:root` token layer (palette, tier colors, cost colors,
spacing, type scale, radii); rules reference only tokens and every value kept
its old number, so nothing moved on screen. Cost color tokens are defined but
unused until the Comp-card slice wires them up. Verified in the browser
(add/remove unit, re-rank, empty state, no console errors); typecheck clean
and all 46 seam tests pass.
