# 07: Board layout

**What to build:** Each comp card renders a hex board with the Comp's units placed on it, using a Board layout derived server-side from CommunityDragon's champion `role` field: tank/bruiser roles on the front rows, carries and casters on the back row. The board is visibly marked as suggested; the meta source has no position data and the UI must never imply otherwise. Unit hexes show portraits, and item icons appear on the units that hold them.

**Blocked by:** 05 (Comp card v1).

**Status:** done

- [x] Comps payload carries a Board layout (hex positions) per Comp
- [x] Card renders the hex board with placed unit portraits and their items
- [x] Layout is labeled as suggested
- [x] API-seam tests assert every board unit gets a position, frontline/backline assignment follows role, and no two units share a hex

## Comments

The spec's premise that CommunityDragon's `role` field can drive the layout
turned out to be mostly false: role is null on 72 of the 74 playable units,
recorded fixture and live payload alike. Role still decides where it exists
(tank/bruiser front, anything else back); null roles fall back to attack
range, melee front and ranged back. The card label and the CONTEXT.md
glossary entry now say "unit roles and range" so the honesty requirement
holds.

Code review (Standards + Spec agents) found three things worth acting on, all
fixed:

- The role assertion was vacuous: both role-carrying units sit exactly where
  range alone would put them. A test now injects a synthetic ranged tank and
  melee caster into the payload and asserts role wins both ways.
- The board label said "not from match data", overstating roles and using an
  avoided glossary term; reworded to "derived from unit roles and range, not
  from the meta source".
- The hex board duplicated the Core Units strip's item-icon markup; both now
  share one SlotItemIcons component. The role regex also dropped "fighter",
  which no payload has ever carried.
