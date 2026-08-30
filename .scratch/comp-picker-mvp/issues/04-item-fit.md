# 04: Item Fit

**What to build:** Items join Holdings. The player enters item components and completed items through a picker built from Set data; Fit now counts compatibility between what they hold and each Comp's best-in-slot items, and the held-versus-missing highlighting extends to items.

**Blocked by:** 03 (Unit Fit tracer).

**Status:** ready-for-agent

- [ ] Item components and completed items can be entered and removed through a searchable picker built from Set data
- [ ] A held component that builds into a Comp's best-in-slot item raises that Comp's Fit (covered by a seam test)
- [ ] Each Comp highlights held versus missing items alongside its item priorities
- [ ] The Fit reason mentions item contributions when they affect the score
- [ ] Item behavior is tested through the server HTTP API only
