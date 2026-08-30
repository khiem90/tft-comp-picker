# 07: Refresh pipeline

**What to build:** The app feeds itself. The real source fetcher lands behind the injected boundary; a Refresh pulls MetaTFT and Community Dragon, transforms the payloads into the Comp and Set data files, and swaps them in. Refresh runs automatically on launch when data is older than 24 hours, and on demand via a manual action. The UI shows when data was last Refreshed and which Patch it reflects. When sources are unreachable, the app keeps running on its last good data.

**Blocked by:** 01 (Walking skeleton), 02 (Source recon).

**Status:** ready-for-agent

- [ ] With no data files present, launching the app fetches sources and self-populates (demoable live)
- [ ] On launch with data older than 24 hours, Refresh runs before recommendations are served
- [ ] On launch with fresh data, no fetch happens
- [ ] A manual Refresh action re-fetches on demand
- [ ] The UI shows last-Refreshed time and the Patch the data reflects
- [ ] When the fetcher fails, the app serves last good data and surfaces that Refresh failed (covered by a seam test with a failing fake fetcher)
- [ ] Refresh behavior is tested through the server HTTP API with fixture payloads via the injected fetcher; no test touches the live sources
