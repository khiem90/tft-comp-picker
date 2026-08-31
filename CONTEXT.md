# TFT Comp Picker

A personal tool for choosing which Teamfight Tactics Set 18 composition to play, given what the player currently has in-game. Comp data is refreshed from a meta source so recommendations track the live patch.

## Language

**Comp**:
A named target board from the meta source: its units, item priorities, augment synergies, and Tier.
_Avoid_: Composition, team comp, build

**Holdings**:
The units, item components, and augments the player currently has in the running game. The input to every recommendation.
_Avoid_: Hand, inventory, board state

**Fit**:
How well the player's Holdings match a Comp. Drives the ranking of comps, scaled by Tier.
_Avoid_: Match score, overlap

**Active game**:
The single running game whose Holdings the app tracks. Persists across page reloads; cleared only by starting a new game. There is no game history.
_Avoid_: Session, match

**Tier**:
The meta source's strength ranking of a Comp on the current patch, independent of the player's Holdings.
_Avoid_: Rank, rating

**Set data**:
The static Set 18 catalog for the current Patch: units, traits, items, augments, and their icons.
_Avoid_: Game data, static data

**Playstyle**:
The leveling archetype the meta source assigns a Comp: Fast 8, Fast 9, lvl 5, lvl 6, lvl 7, or Standard.
_Avoid_: Comp origin, archetype, levelling

**Core Units**:
The item-carrying units of a Comp, as marked by the meta source with their builds. Every other unit on the board is filler.
_Avoid_: Carries, item holders

**Star target**:
A unit players commonly 3-star when playing a Comp, per the meta source. Only units on the Comp's board count.
_Avoid_: 3-star carry, reroll target

**Board layout**:
A suggested placement of a Comp's units on the hex board, derived locally from unit roles and attack range (frontline/backline). Not source data; the meta source has no positions, and the role field is null on nearly every unit, so range carries most placements.
_Avoid_: Positioning, formation

**Patch**:
A biweekly game update. A new Patch invalidates both Set data and Comps until refreshed.

**Refresh**:
Re-fetching Comps and Set data from sources. Happens on launch when data is older than 24 hours, or on demand.
_Avoid_: Sync, update check

**Stale**:
A Comp no longer backed by fresh source data. A Comp that dropped off the source is removed; one that fell in Tier is kept but ranked down; a Patch change flags everything until Refresh.
_Avoid_: Outdated, irrelevant
