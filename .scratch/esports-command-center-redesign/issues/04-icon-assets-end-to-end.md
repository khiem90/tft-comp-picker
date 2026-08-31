# 04: Icon assets end to end

**What to build:** Refresh downloads unit square tiles, trait icons, and item/component icons (roughly 130 PNGs) to local files keyed by apiName, using CommunityDragon's game path with `.tex` swapped for `.png` (convention verified live). Icons are Set data: a Patch change stales them and Refresh replaces them. The Holdings rail renders held units as portraits with cost-colored frames and held items as icons with multiset count badges. Any missing, failed, or upstream-placeholder icon renders a neutral fallback tile. Augment icons are skipped while the source returns no augment data.

**Blocked by:** 02 (Preserve apiName through the pipeline), 03 (Dashboard shell).

**Status:** done

- [x] Refresh writes icon files locally and the payloads reference them; no third-party CDN requests at render time
- [x] Holdings units show portraits with cost-colored frames; items show icons with count badges
- [x] Fallback tile renders for absent or failing icons
- [x] Refresh-seam tests (stubbed fetcher extended with fake icon bytes) assert files land where the payload says and that a failed icon fetch degrades without failing the Refresh
- [x] App renders fully offline once a Refresh has completed

## Comments

Done. `SourceFetcher` grew an optional `fetchIcon(sourcePath)`; the live
fetcher resolves it against `raw.communitydragon.org/latest/game/` with the
`.tex`-to-`.png` swap on lowercased paths. The transform emits icon jobs
(unit square tiles via `tileIcon`, trait, item, and component icons; 175 in
the recorded payload, not the estimated 130) and a new optional
`setData.components` catalog, because Holdings hold raw components and their
icons had no other home in the payload. A new `src/server/icons.ts` owns the
download step: files land at `data/icons/<kind>/<apiName>.png` with
write-then-rename, eight at a time, and only icons actually on disk get
`/icons/...` refs stamped onto the payload, so an absent `icon` field is the
UI's single fallback signal. Failures never fail the Refresh; the next
same-Patch Refresh retries just the missing files. A Patch change (or a
missing/corrupt comps.json, which makes surviving icons' Patch unknowable)
wipes the directory first. `createApp` serves `data/icons` at `/icons`.

UI: `IconTile` renders every icon and collapses missing refs and load errors
to the neutral letter tile. Held units are portraits with `--cost-N` frame
borders; held items group into one tile per name with a count badge, and a
click removes one copy. Augment icons stay untouched (source still returns no
augment data).

Ten refresh-seam tests in `tests/icons.test.ts` cover: files landing where
the payload points, HTTP serving, path conversion, per-icon failure degrade,
fetchers without `fetchIcon`, same-Patch skip and retry, Patch-boundary and
orphaned-icon replacement, and placeholder-path skipping ("missing"-prefixed
path segments, per the known `missing-t2` placeholder).

Review findings applied: `syncIcons` renamed to `downloadIcons` ("Sync" is
avoided vocabulary under Refresh); orphaned icons with no comps.json now
count as stale (spec gap the review caught); the placeholder filter narrowed
from substring to path-segment prefix. Verified in the browser against live
sources: 175 PNGs downloaded on manual Refresh, portraits and count badges
render from localhost only, zero CDN requests at render time, fallback tiles
shown for pre-icon disk data. Typecheck clean; 60 seam tests pass.
