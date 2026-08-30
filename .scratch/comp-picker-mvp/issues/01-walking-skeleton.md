# 01: Walking skeleton

**What to build:** One command starts the app. The server reads a hand-seeded Comps file and Set data file from disk and serves them over its HTTP API; the UI shows every Comp in Tier order, each with its final board and item priorities. This lands the repo scaffold, the single test seam, and the first test through it.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] A single command starts the server and serves the UI locally
- [x] Comps and Set data load from plain JSON files on disk, hand-editable
- [x] The UI lists all seeded Comps in Tier order, showing each Comp's final board and item priorities
- [x] At least one test exercises the server HTTP API end-to-end (request in, ranked Comp list out), establishing the seam pattern
- [x] An ADR records the scrape-with-fallback source decision (MetaTFT primary, tactics.tools then hand-curated file as fallbacks)
- [x] The repo is a git repository with an initial commit
