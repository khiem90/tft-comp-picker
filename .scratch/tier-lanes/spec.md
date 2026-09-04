# Tier Lanes

Status: done

The UI becomes a tier list. The meta source ranks Comps in Tiers, so the page
shows every Comp in its Tier's lane, sorted within the lane by the server's
ranking, with the overall best flagged wherever it lands. The chosen Comp opens
in a drawer on the right. Picked from three prototypes in `output/redesigns/round2/`.

## What changed

- Top bar holds the Active game as chips (unit portraits with cost rims, item
  icons with counts, augment names). Clicking a chip removes that Holding. The
  `+` button opens the picker row; it opens by itself on an empty game.
- The picker row keeps one search per Holdings kind. Held entries are no longer
  repeated under the search; the chips are the one place they show.
- Patch, refreshed-at, Refresh, and New game live in the top bar. The status
  rail is gone.
- Filters are a bar above the lanes. Tier narrows the page to one lane; Trait
  and Playstyle thin every lane. Ranks stay the full ranking's ranks.
- Lanes: S to D, one giant letter each, tiles of the Comp's four Core Units
  (filler after them), name, held/total, rank, fit bar. Tiles with zero held
  units dim once Holdings exist. Empty lanes are hidden.
- A note under the best Comp's lane explains a best that sits below a stronger
  lane: "X outranks every S comp because you hold N of its M units."
- Drawer: Tier, rank, Playstyle, name, three numbers (fit, units held, gold to
  buy the rest), the Board layout with held units in color and missing ones
  dimmed, traits, buy list cheapest first, item priorities as built/half/none,
  augments when the Comp carries any, and the fit reason.
- "Gold to buy the rest" is the shop price of the board units not held, summed
  in the UI from board costs.

## Not changed

- Ranking, Fit, Refresh, staleness, Active game storage, and every server
  contract. `filters.ts` and `activeGame.ts` are untouched.
