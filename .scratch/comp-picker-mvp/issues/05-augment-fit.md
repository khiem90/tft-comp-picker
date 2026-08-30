# 05: Augment Fit

**What to build:** Augments join Holdings, conditioned on what recon found. If the source provides usable augment-to-comp data, entered augments contribute to Fit with reasons. If it does not, this ticket delivers graceful absence: augment entry is hidden or inert and rankings work on unit and item Fit alone, exactly as if augments didn't exist.

**Blocked by:** 02 (Source recon), 03 (Unit Fit tracer).

**Status:** ready-for-agent

- [ ] If augment data exists: augments can be entered through a searchable picker and raise the Fit of synergizing Comps, with reasons (covered by a seam test)
- [ ] If augment data does not exist: the app shows no broken or misleading augment UI, and rankings are unaffected
- [ ] Missing augment data for an individual Comp never blocks or distorts that Comp's ranking
- [ ] Behavior is tested through the server HTTP API only
