# 06: Core Units strip + Star targets

**What to build:** Each comp card gains a Core Units strip: the item-carrying units from MetaTFT's `builds` (four per Comp) shown as portraits with their build items, plus 3-star markers on Star targets. Star targets are the source's `stars` list intersected with the Comp's own board (the raw list includes stray units from cluster classification and must never render unfiltered), with unresolvable names dropped.

**Blocked by:** 05 (Comp card v1).

**Status:** done

- [x] Comps payload carries Core Units with build items and filtered Star targets
- [x] Card strip shows Core Unit portraits, their build item icons, and star markers on Star targets
- [x] Units in the source's star list that are not on the Comp's board do not appear
- [x] API-seam tests assert Core Units and Star target filtering against the recorded fixtures

## Comments

Code review (Standards + Spec agents) found two things worth acting on, both fixed:

- Star targets are not always Core Units (12 of 53 live clusters have on-board
  stars outside `builds`), so the strip's markers alone would hide some. Board
  slots now carry the marker too.
- The icon maps threaded to the cards were a growing prop clump; they now
  travel as one `CompIcons` bundle.

One deliberate deviation from the issue text: "four per Comp" describes the raw
`builds` list, but nine recorded clusters list a headliner variant that is not
on the board. Those are dropped, same rule as Star targets, so a Comp can serve
three Core Units. An off-board unit has no slot, name, or portrait to render.
