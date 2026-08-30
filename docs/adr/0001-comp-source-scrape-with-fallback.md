# ADR-0001: Scrape MetaTFT for Comps, with fallbacks

Status: accepted
Date: 2026-08-29

## Context

The app promises rankings that track the live Patch, which means it needs a source of current Comps and their Tiers. Riot offers no API for meta compositions, and building our own comp statistics from the match API is out of scope. The sites that do have this data (MetaTFT, tactics.tools) expose it only through undocumented internal endpoints that their own frontends call. Anything we scrape can break without notice, on their schedule.

A future reader will reasonably ask why an app that checks its sources daily leans on endpoints nobody promised to keep stable. This ADR is the answer.

## Decision

Comps come from MetaTFT's internal endpoints as the primary source. When that breaks, the fallback order is tactics.tools, then a hand-curated Comps file. Static Set data comes from Community Dragon's merged TFT JSON, which is confirmed to update per Patch.

Two design choices contain the blast radius of a broken scrape:

- Comps and Set data persist as plain JSON files on disk. The app always runs from these files, never directly from a fetch, so an unreachable source degrades to stale-but-working data. The same files are the hand-curated fallback: when scraping breaks, the player edits JSON and keeps playing.
- The source fetcher is an injected dependency of the server. Swapping MetaTFT for tactics.tools, or for a fixture in tests, is the same operation.

## Consequences

- Scrape breakage is a routine event to plan for, not an outage. The app keeps working on last good data, and the hand-edit path is always open.
- The fetcher must be probed against MetaTFT's real responses at build time (issue 02), since there is no documentation to code against. If augment data turns out thinner than hoped, rankings fall back to unit and item Fit alone.
- We accept a light ethical and practical dependency on unsanctioned endpoints for a personal, single-user tool with daily-at-most request volume.
