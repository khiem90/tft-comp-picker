# 04: Icon assets end to end

**What to build:** Refresh downloads unit square tiles, trait icons, and item/component icons (roughly 130 PNGs) to local files keyed by apiName, using CommunityDragon's game path with `.tex` swapped for `.png` (convention verified live). Icons are Set data: a Patch change stales them and Refresh replaces them. The Holdings rail renders held units as portraits with cost-colored frames and held items as icons with multiset count badges. Any missing, failed, or upstream-placeholder icon renders a neutral fallback tile. Augment icons are skipped while the source returns no augment data.

**Blocked by:** 02 (Preserve apiName through the pipeline), 03 (Dashboard shell).

**Status:** ready-for-agent

- [ ] Refresh writes icon files locally and the payloads reference them; no third-party CDN requests at render time
- [ ] Holdings units show portraits with cost-colored frames; items show icons with count badges
- [ ] Fallback tile renders for absent or failing icons
- [ ] Refresh-seam tests (stubbed fetcher extended with fake icon bytes) assert files land where the payload says and that a failed icon fetch degrades without failing the Refresh
- [ ] App renders fully offline once a Refresh has completed
