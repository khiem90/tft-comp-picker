# ADR-0003: Statistical Board layout cells from MetaTFT, not curated boards

Status: accepted
Date: 2026-08-31

## Context

Board layouts were a local role-and-range guess because the MVP recon found no position data on the scraped endpoints. A later recon found two real options: MetaTFT's comp-details endpoint, which reports each unit's most-played cells per cluster as game statistics, and TFTAcademy's data routes, which ship hand-curated boards with exact hexes. A future reader will wonder why boards are assembled from per-unit statistics, with an occupancy walk to resolve conflicts, instead of read whole from a curated source.

## Decision

Positions come from MetaTFT's comp-details endpoint, placed greedily per unit by play count, exactly as MetaTFT's own site renders them. It shares the cluster ids and apiNames the app already scrapes, so there is no cross-source matching, and it adds no second site to break. TFTAcademy was rejected for now: its payload is an internal SvelteKit format needing a custom decoder, its hand-authored comps match our clusters only by fuzzy unit overlap, and it lags patches at human speed. The local heuristic stays as the fallback for units and Comps the data misses.

## Consequences

- A board is the mode of real games, not an authored answer. Two units' popular cells can conflict, and the occupancy walk resolves that in source unit order, so a rare board differs slightly from any single real game.
- Position freshness is coupled to the cluster generation, so the details fetch must run inside the same Refresh as the cluster fetch, never independently.
- If MetaTFT's coverage disappoints, the recorded TFTAcademy option is the documented next step, slotting between the source and the heuristic in ADR-0001's fallback ladder.
