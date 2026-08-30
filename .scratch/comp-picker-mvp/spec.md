# Comp Picker MVP

Status: ready-for-agent

## Problem Statement

Playing TFT Set 18, I have to decide which Comp to commit to based on the units, item components, and augments I happen to have. Today that means alt-tabbing to tier list sites and eyeballing which Comp my hand points toward, under a shop timer. The sites rank Comps in a vacuum; none of them answer "given what I hold right now, what should I build?". And because the meta shifts every two weeks (faster at set launch), any static answer rots quickly.

## Solution

A local web app I keep open while playing. I enter my Holdings as the game progresses, and the app shows every Comp for the current Patch, sorted by Fit scaled by Tier, live-updating with each entry. Each Comp shows its final board and item priorities, with what I already hold highlighted against what's missing. On launch, if its data is older than 24 hours, the app Refreshes Comps and Set data from its sources before recommending, so the rankings track the live Patch without my attention.

## User Stories

1. As a player, I want to enter the units I currently own, so that the app can rank Comps by how well my board points toward them.
2. As a player, I want to enter my item components and completed items, so that item compatibility counts toward each Comp's Fit.
3. As a player, I want to enter the augments I have picked, so that Comps that synergize with them rank higher when augment data is available.
4. As a player, I want entry to be a fast searchable picker, so that recording a Holding fits inside a planning-phase timer.
5. As a player, I want the pickers built from the current Set data, so that units, items, and augments added in a new Patch appear without code changes.
6. As a player, I want the Comp list to re-sort live as I enter each Holding, so that I always see the current best options without pressing anything.
7. As a player, I want every Comp to remain visible, sorted rather than filtered out, so that I can spot pivot options even when they fit my Holdings poorly.
8. As a player, I want each Comp to show its final board, so that I know what I am building toward.
9. As a player, I want each Comp to show its item priorities and best-in-slot items, so that I know what to build from my components.
10. As a player, I want each Comp to highlight which of its units and items I already hold versus which are missing, so that I can judge my distance to completion at a glance.
11. As a player, I want each Comp to show its Fit score and the reason behind it, so that I can trust the ranking or knowingly override it.
12. As a player, I want ranking to be Fit-dominant with Tier as a scaling factor, so that a lower-Tier Comp I can actually build outranks a top-Tier Comp I cannot.
13. As a player, I want the ranking to fall back to Tier order when I have entered nothing yet, so that the app is useful from the first shop.
14. As a player, I want my Active game's Holdings to survive a page reload, so that an accidental refresh mid-game loses nothing.
15. As a player, I want a single new-game action that clears all Holdings, so that starting the next game takes one click.
16. As a player, I want the app to Refresh automatically on launch when its data is older than 24 hours, so that recommendations track the current Patch without my attention.
17. As a player, I want a manual Refresh action, so that I can force an update the moment a Patch drops.
18. As a player, I want to see when data was last Refreshed and which Patch it reflects, so that I can judge whether to trust the rankings.
19. As a player, I want a Comp that vanished from the meta source to be removed on Refresh, so that dead Comps stop distracting me.
20. As a player, I want a Comp that dropped in Tier to be kept but ranked down, so that I still see it when my Holdings fit it well.
21. As a player, I want a Patch change to trigger a full re-pull of Set data and Comps with changes flagged, so that I notice what moved.
22. As a player, I want the app to keep working on its last good data when the meta source is unreachable, so that a broken scrape degrades instead of killing the app.
23. As a player, I want Comp data stored as a plain editable file, so that I can hand-patch or swap sources when scraping breaks.
24. As a player, I want rankings to work on unit and item Fit alone when augment data is unavailable, so that missing augment stats never block recommendations.
25. As a player, I want the app to start with one command, so that opening it before a session is trivial.

## Implementation Decisions

- Local web app for one user: a small Node server plus a React UI, started with one command. The server does all source fetching, because browser-side fetches hit CORS and the scraping logic belongs behind the seam anyway.
- Ranking happens server-side. The client is deliberately dumb: render the sorted Comp list, capture Holdings input, persist the Active game in browser storage.
- Holdings are entered manually. No live-game integration of any kind: Riot exposes no TFT live state through its APIs, and its developer policy prohibits real-time recommendations from a running game's state.
- Static Set data comes from Community Dragon's merged TFT JSON, confirmed to update per Patch. Comps come from MetaTFT's internal endpoints. Fallback order when that breaks: tactics.tools, then a hand-curated file.
- Both Comps and Set data persist as plain JSON data files on disk. All set-specific content lives in data, not code; Set 18 is the only supported set.
- The source fetcher is an injected dependency of the server. Swapping sources and faking sources in tests are the same operation.
- Fit is computed from unit overlap and item-component compatibility with a Comp's best-in-slot items, plus augment synergy when the source provides it. The final ranking is Fit scaled by a modest Tier weight, so Tier decides early (when everyone's Fit is near zero) and the player's actual hand takes over as entries accumulate.
- Staleness rules on Refresh: Patch changed means re-pull everything and flag changes; Comp missing from the source means remove it; Comp fell in Tier means keep it, ranked down.
- Refresh runs on launch when data is older than 24 hours, plus a manual trigger. No scheduled background job; nothing needs to be always-on.
- The Active game is a single persisted state with a reset action. No game history.

## Testing Decisions

- A good test exercises external behavior only: call the server's HTTP API, assert on the response. No tests reach into scoring helpers or refresh internals.
- The server HTTP API is the single seam. The one injected boundary inside it is the source fetcher, which tests replace with recorded fixture payloads.
- Behaviors to cover through that seam: ranking order (including the B-tier-fits-beats-S-tier-doesn't case and the empty-Holdings Tier-order case), live re-ranking as Holdings change, each of the three staleness reactions, the 24-hour Refresh trigger, and degraded mode when the fetcher fails.
- Deliberately untested: the React UI (verified by eye) and live scraping against the real MetaTFT (it breaks on their schedule, not ours; a failing fixture test would prove nothing).
- No prior art: this is a greenfield repo, so these tests set the pattern.

## Out of Scope

- Automatic detection of game state (screen capture, memory reading, overlays, Overwolf).
- Stage, level, gold, or HP awareness; the player supplies the game-state judgment.
- Unit star levels and duplicate copy counts in Fit.
- Pivot-specific advice beyond what the always-visible sorted list already provides.
- Game history or saved sessions beyond the single Active game.
- Sets other than 18, multi-user support, accounts, hosting, mobile.
- Building our own comp statistics from Riot's match API.

## Further Notes

- Set 18 "Enchanted Wilds" launched around August 25, 2026 and patches land biweekly with B-patches between, so the meta will churn hardest in the first month. The daily Refresh matters most right now.
- MetaTFT's endpoints are undocumented and unsanctioned. Their exact data shape must be probed at build time before the fetcher is written; if comp data (especially augment mappings) is thinner than hoped, user story 24 is the escape hatch.
- The scrape-with-fallback source decision deserves an ADR at first commit: a future reader will wonder why a "checks its sources daily" app leans on undocumented endpoints.
- Domain vocabulary (Comp, Holdings, Fit, Tier, Set data, Patch, Refresh, Stale, Active game) is defined in the root CONTEXT.md and used as-is throughout this spec.
