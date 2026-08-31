# 01: Prefactor: component split + CSS token layer

**What to build:** The app looks and behaves exactly as it does today, but the single UI component is split into focused components and every hardcoded color, spacing, and type value moves into a CSS custom-property token layer (palette, tier colors, cost colors, spacing, type scale). This makes every later redesign slice an easy change.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The UI is composed of separate components (header, Holdings sections, comp list/card, status banners) instead of one monolith
- [ ] All colors, spacing, and type values are CSS custom properties; no repeated hex literals in rules
- [ ] Visual output and behavior are unchanged
- [ ] The existing API-seam test suite passes untouched
