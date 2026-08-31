# 07: Board layout

**What to build:** Each comp card renders a hex board with the Comp's units placed on it, using a Board layout derived server-side from CommunityDragon's champion `role` field: tank/bruiser roles on the front rows, carries and casters on the back row. The board is visibly marked as suggested; the meta source has no position data and the UI must never imply otherwise. Unit hexes show portraits, and item icons appear on the units that hold them.

**Blocked by:** 05 (Comp card v1).

**Status:** ready-for-agent

- [ ] Comps payload carries a Board layout (hex positions) per Comp
- [ ] Card renders the hex board with placed unit portraits and their items
- [ ] Layout is labeled as suggested
- [ ] API-seam tests assert every board unit gets a position, frontline/backline assignment follows role, and no two units share a hex
