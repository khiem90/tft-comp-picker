# 02: Source recon

**What to build:** Certainty about what the sources actually provide. Probe MetaTFT's internal endpoints and Community Dragon's merged Set 18 JSON, capture real response payloads as test fixtures, and write a findings note deciding how source data maps onto our Comp and Set data shapes.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Recorded MetaTFT payloads covering the comp list (units, item priorities, Tier) are saved as fixtures
- [ ] A recorded Community Dragon payload covering Set 18 units, traits, items, and augments is saved as a fixture
- [ ] A findings note states the mapping from each source payload to Comp and Set data, and which fields identify the current Patch
- [ ] The note answers definitively: does the source provide augment-to-comp data usable for Fit?
- [ ] The note flags any gap that changes the spec's assumptions (e.g. missing best-in-slot items)
