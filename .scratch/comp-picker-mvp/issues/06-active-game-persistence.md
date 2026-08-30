# 06: Active game persistence

**What to build:** The Active game survives accidents and resets on purpose. Holdings persist in the browser across page reloads and crashes; a single new-game action clears everything back to empty. There is exactly one Active game and no history.

**Blocked by:** 03 (Unit Fit tracer).

**Status:** ready-for-agent

- [ ] Reloading the page mid-game restores all entered Holdings and the resulting ranking
- [ ] The new-game action clears all Holdings in one interaction and returns the list to Tier order
- [ ] No game history accumulates; starting a new game discards the previous Active game entirely
