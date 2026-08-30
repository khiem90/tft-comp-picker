# 07: Refresh pipeline

**What to build:** The app feeds itself. The real source fetcher lands behind the injected boundary; a Refresh pulls MetaTFT and Community Dragon, transforms the payloads into the Comp and Set data files, and swaps them in. Refresh runs automatically on launch when data is older than 24 hours, and on demand via a manual action. The UI shows when data was last Refreshed and which Patch it reflects. When sources are unreachable, the app keeps running on its last good data.

**Blocked by:** 01 (Walking skeleton), 02 (Source recon).

**Status:** ready-for-agent

- [x] With no data files present, launching the app fetches sources and self-populates (demoable live)
- [x] On launch with data older than 24 hours, Refresh runs before recommendations are served
- [x] On launch with fresh data, no fetch happens
- [x] A manual Refresh action re-fetches on demand
- [x] The UI shows last-Refreshed time and the Patch the data reflects
- [x] When the fetcher fails, the app serves last good data and surfaces that Refresh failed (covered by a seam test with a failing fake fetcher)
- [x] Refresh behavior is tested through the server HTTP API with fixture payloads via the injected fetcher; no test touches the live sources
- [x] The transform maps MetaTFT `top_augments` (when non-empty) onto `Comp.augments`, so the augment Fit shipped in 05 turns itself on the day the source publishes augment stats

## Comments

Implemented 2026-08-30. The fetcher (`src/server/sources.ts`) pulls three endpoints: MetaTFT patch, MetaTFT comps_data, and Community Dragon. comps_stats turned out unnecessary; Tier derives from `overall.avg` in comps_data. Bucketing rule (this issue owned it, per recon gap 1): fixed average-placement thresholds around the neutral 4.5 finish (S ≤ 4.35, A ≤ 4.65, B ≤ 4.95, C ≤ 5.35, else D), so a Comp's Tier never shifts just because other clusters entered the pool. The "on launch" trigger is applied lazily on the first API request, which is what makes it seam-testable and still satisfies "before recommendations are served". Data seeds in `data/` were regenerated from the recorded fixtures, so the committed files now carry real Set 18 comps at patch 18.1 (recon gap 4). Self-population was also verified once against the live sources.

Post-review follow-ups (two-axis review, same day): the Fit item pool now merges each carry's best-in-slot build into `itemPriorities` alongside `top_itemNames` (recon gap 3), live fetches carry a 60s deadline so a hanging source degrades like an erroring one, and the Comp augment filter matches the picker's catalog filter. Two deliberate departures worth naming: the server takes a second injected dependency, a clock (`now`), purely so seam tests can control the 24-hour trigger; and the staleness check runs lazily on every request rather than once at process start, which is what makes "Refresh before recommendations are served" testable through the HTTP API and also covers an app left open across days. Known remainder: `refreshError` is in-memory, so a restart forgets a failed Refresh until the next attempt re-surfaces it; harmless because a restart with stale data retries immediately.
