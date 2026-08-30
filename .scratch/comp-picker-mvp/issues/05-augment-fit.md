# 05: Augment Fit

**What to build:** Augments join Holdings, conditioned on what recon found. If the source provides usable augment-to-comp data, entered augments contribute to Fit with reasons. If it does not, this ticket delivers graceful absence: augment entry is hidden or inert and rankings work on unit and item Fit alone, exactly as if augments didn't exist.

**Blocked by:** 02 (Source recon), 03 (Unit Fit tracer).

**Status:** ready-for-agent

- [x] If augment data exists: augments can be entered through a searchable picker and raise the Fit of synergizing Comps, with reasons (covered by a seam test)
- [x] If augment data does not exist: the app shows no broken or misleading augment UI, and rankings are unaffected
- [x] Missing augment data for an individual Comp never blocks or distorts that Comp's ranking
- [x] Behavior is tested through the server HTTP API only

## Comments

Implemented 2026-08-29. Recon (issue 02) found MetaTFT's `top_augments` empty on every
cluster, so the live path today is graceful absence: `data/comps.json` carries no
`augments` field, the UI renders no augment entry, and rankings run on unit and item Fit.
The data-present path is fully built and seam-tested against `tests/fixtures/with-augments/`.

Decisions worth knowing later:

- A matched augment counts as one held piece in the Fit numerator but augments never join
  the denominator, so a Comp the source has no augment data for scores exactly as if
  augments did not exist. The ranking keeps any overflow past 100% (synergy breaks ties
  between complete Comps); only the displayed score caps at 100.
- The augment picker renders only when the Set data catalog offers augments AND at least
  one Comp carries augment synergies. Held augment chips keep the section alive even if
  the data disappears on a Refresh, so nothing affects the query invisibly. A player
  therefore cannot pre-enter augments while no fetched Comp has augment data; that is the
  ticket's "hidden or inert" reading, chosen deliberately.
- Mapping `top_augments` into `Comp.augments` belongs to the fetcher; a checklist line was
  added to issue 07.
