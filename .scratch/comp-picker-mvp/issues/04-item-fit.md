# 04: Item Fit

**What to build:** Items join Holdings. The player enters item components and completed items through a picker built from Set data; Fit now counts compatibility between what they hold and each Comp's best-in-slot items, and the held-versus-missing highlighting extends to items.

**Blocked by:** 03 (Unit Fit tracer).

**Status:** ready-for-agent

- [x] Item components and completed items can be entered and removed through a searchable picker built from Set data
- [x] A held component that builds into a Comp's best-in-slot item raises that Comp's Fit (covered by a seam test)
- [x] Each Comp highlights held versus missing items alongside its item priorities
- [x] The Fit reason mentions item contributions when they affect the score
- [x] Item behavior is tested through the server HTTP API only
