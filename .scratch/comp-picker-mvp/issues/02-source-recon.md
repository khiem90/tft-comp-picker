# 02: Source recon

**What to build:** Certainty about what the sources actually provide. Probe MetaTFT's internal endpoints and Community Dragon's merged Set 18 JSON, capture real response payloads as test fixtures, and write a findings note deciding how source data maps onto our Comp and Set data shapes.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] Recorded MetaTFT payloads covering the comp list (units, item priorities, Tier) are saved as fixtures
- [x] A recorded Community Dragon payload covering Set 18 units, traits, items, and augments is saved as a fixture
- [x] A findings note states the mapping from each source payload to Comp and Set data, and which fields identify the current Patch
- [x] The note answers definitively: does the source provide augment-to-comp data usable for Fit?
- [x] The note flags any gap that changes the spec's assumptions (e.g. missing best-in-slot items)

## Comments

Recon done 2026-08-29. Fixtures live in `tests/fixtures/recorded/`; findings in `../source-recon.md`. Headline answers: ids join across sources with zero misses, Patch comes from MetaTFT's `tft-stat-api/patch` endpoint ("18.1"), Tier letters are not served and must be derived from placement stats, and augment-to-comp data (`top_augments`) is present but empty on all 53 clusters, so the MVP ranks on unit and item Fit alone.
