# 06: Active game persistence

**What to build:** The Active game survives accidents and resets on purpose. Holdings persist in the browser across page reloads and crashes; a single new-game action clears everything back to empty. There is exactly one Active game and no history.

**Blocked by:** 03 (Unit Fit tracer).

**Status:** ready-for-agent

- [x] Reloading the page mid-game restores all entered Holdings and the resulting ranking
- [x] The new-game action clears all Holdings in one interaction and returns the list to Tier order
- [x] No game history accumulates; starting a new game discards the previous Active game entirely

## Comments

Implemented as a storage codec module (`src/ui/activeGame.ts`) plus thin wiring in
`App.tsx`: lazy state init from `loadActiveGame`, a persist effect on every Holdings
change, and a New game button that clears storage and state.

Testing note: the spec's agreed seam is the server HTTP API, with the React UI
verified by eye. Persistence lives client-side, so the codec got its own vitest file
(`tests/active-game.test.ts`) against a fake Storage, covering restore, reset, corrupt
saved data, and a browser that refuses storage access. The React wiring stayed
untested per the spec; verified by driving the app in a browser (reload restores
Holdings and ranking, one click resets to Tier order).
