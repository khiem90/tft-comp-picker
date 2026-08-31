# 06: Core Units strip + Star targets

**What to build:** Each comp card gains a Core Units strip: the item-carrying units from MetaTFT's `builds` (four per Comp) shown as portraits with their build items, plus 3-star markers on Star targets. Star targets are the source's `stars` list intersected with the Comp's own board (the raw list includes stray units from cluster classification and must never render unfiltered), with unresolvable names dropped.

**Blocked by:** 05 (Comp card v1).

**Status:** ready-for-agent

- [ ] Comps payload carries Core Units with build items and filtered Star targets
- [ ] Card strip shows Core Unit portraits, their build item icons, and star markers on Star targets
- [ ] Units in the source's star list that are not on the Comp's board do not appear
- [ ] API-seam tests assert Core Units and Star target filtering against the recorded fixtures
