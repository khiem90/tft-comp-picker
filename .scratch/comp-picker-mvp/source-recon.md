# Source recon findings (issue 02)

Captured 2026-08-29 against live sources. TFT patch at capture: 18.1 (Set 18, four days after set launch). Everything below was verified against recorded payloads, not documentation, because none exists.

## Recorded fixtures

All under `tests/fixtures/recorded/`:

| File | Source | Trimming |
| --- | --- | --- |
| `metatft-patch.json` | `GET https://api-hc.metatft.com/tft-stat-api/patch` | none |
| `metatft-comps_data.json` | `GET https://api-hc.metatft.com/tft-comps-api/comps_data?queue=1100` | none (215 KB) |
| `metatft-comps_stats.json` | `GET https://api-hc.metatft.com/tft-comps-api/comps_stats?queue=1100&patch=current&days=3&rank=CHALLENGER,DIAMOND,EMERALD,GRANDMASTER,MASTER,PLATINUM&permit_filter_adjustment=true` | none |
| `cdragon-set18.json` | `GET https://raw.communitydragon.org/latest/cdragon/tft/en_us.json` | filtered, see below |

The Community Dragon file is 24 MB raw because it carries every set back to Set 1. The fixture keeps the original top-level shape (`items`, `setData`, `sets`) but filters arrays: `items` down to the `DA_` prefix (Set 18's namespace, 756 entries), `setData` to the `TFTSet18` entry, and `sets` to key `"18"` kept whole. Individual objects are verbatim; no fields were stripped inside any object.

`queue=1100` is the ranked queue. The endpoints live on `api-hc.metatft.com`; the same path on `api.metatft.com` 404s.

## How MetaTFT models comps

`comps_data` returns statistical clusters, not hand-authored comps. At capture: 53 clusters under `results.data.cluster_details`, keyed by cluster id (`422000`...). `results.data.tft_set` is `"TFTSet18"` and a top-level `updated` field (epoch ms) sits beside `results`. Each cluster carries:

- `units_string`: the comp's units as internal ids, e.g. `"DA_18_Kobuko, DA_18_Lillia, ..., DA_18_Rengar"` (7 to 8 units).
- `traits_string`: active traits with a count suffix, e.g. `"DA_18_Fae_2, DA_Juggernaut18_1"`.
- `name` / `name_string`: the comp's naming parts (a trait plus a carry unit, each with a score). The site renders these as titles like "Fae Rengar". Display names come from Set data, not from this payload.
- `overall`: `{ count, avg }`, games played and average placement.
- `builds`: the top carry units, each with a 3-item `buildName` array of item ids, play count, and average placement. This is the best-in-slot data. Only the top ~4 carries per cluster get item builds; the rest of the board has no item data.
- `build_items` and `top_itemNames`: items ranked by play count across the cluster. This is the item-priority data.
- `top_augments`: present on every cluster and empty on every cluster (see below).
- `trends`, `levelling`, `difficulty`, `diff_pick`, `diff_place`: not needed for the MVP.

`comps_stats` returns one row per cluster with a `places` array (placement distribution, positions 1 to 8, then total). The site's tier list runs on this.

## Mapping onto our Comp shape

| Comp field | Source |
| --- | --- |
| `id` | cluster id (string of the `cluster_details` key) |
| `name` | `name_string` ids resolved to display names via Set data |
| `tier` | derived, not provided (see gaps) |
| `board` | `units_string` split on `", "`; cost and display name joined from Set data |
| `board[].items` | `builds` entry for that unit, when one exists |
| `itemPriorities` | `top_itemNames` order (already ranked by count) |

## Mapping onto our Set data shape

From `cdragon-set18.json`:

- Units: `sets["18"].champions`, each with `apiName`, `name`, `cost`, `traits`. The playable-roster filter is `traits.length > 0`; 74 of 91 champions pass, the rest are eggs, training dummies, and PvE monsters. Champion `traits` hold display names ("Rival"), not apiNames.
- Traits: `sets["18"].traits`, each with `apiName` ("DA_18_Elderwood") and `name` ("Elderwood"). This is the bridge between champion trait names and MetaTFT trait ids.
- Items: `items` filtered to apiNames starting `DA_` and `isAugment: false`. Completed items carry `composition` arrays of the 10 components (`DA_Component_BFSword`, ..., `DA_Component_Spatula`, `DA_Component_FryingPan`). Emblems exist as items (`DA_18_EmblemFae` = Spatula + BF Sword).
- Augments: same `items` array with `isAugment: true` (254 entries).

## Id joins, verified exhaustively

Every id in the MetaTFT comps payload resolves against a Community Dragon `apiName`: 431 unit references, 368 trait references, and 1155 item references across all 53 clusters, zero misses. Trait ids need the trailing count stripped first (`DA_18_Fae_2` joins as `DA_18_Fae`). The fetcher needs no fuzzy matching and no name tables of its own.

MetaTFT also publishes its own lookup file (`https://data.metatft.com/lookups/TFTSet18_latest_en_us.json`, 1.3 MB) with the same id-to-name data. Not recorded as a fixture; Community Dragon already covers the mapping and is the source the spec committed to.

## Patch identity

- `tft-stat-api/patch` is authoritative for the app's Patch: `{"patch":"18.1","b_patch_version":"","full_padded_patch":"0018.0001","start":"2026-08-25T18:36:42.967Z",...}`. It also exposes B-patches, which the spec cares about.
- `comps_data` itself carries no patch field, only `tft_set` and the `updated` timestamp. Its `patch=current` behavior means it silently follows the live patch.
- The Community Dragon merged JSON has no patch field at all. `https://raw.communitydragon.org/latest/content-metadata.json` returns the client build (`16.17.8104348+...`), which uses LoL client numbering, not TFT patch numbering. Treat it as a change detector for Set data, never as the Patch label.

## Does the source provide augment-to-comp data usable for Fit?

No. `top_augments` exists on all 53 clusters and is empty on all 53. The set is four days old and MetaTFT has evidently not accumulated (or not yet enabled) augment stats per cluster. So the MVP ships on unit and item Fit alone, exactly the user story 24 escape hatch. The field's existence means it may populate later in the set; issue 05 should read `top_augments` when non-empty and contribute zero otherwise, so augment Fit turns itself on if the data appears.

## Gaps that change spec assumptions

1. Tier letters are not served by any endpoint. The site computes S/A/B client-side from placement stats. Our fetcher must derive Tier by bucketing clusters on `overall.avg` (or the `comps_stats` distribution). The walking skeleton's assumption that the source hands us a Tier is wrong; issue 07 owns the bucketing rule.
2. Augment-to-comp data is empty (above).
3. Best-in-slot items exist only for the top carries of each cluster, not for every board slot. The seeded fixture shape (items on arbitrary board slots) is richer than reality. Fit's item axis should score against the cluster's item pool (`builds` + `top_itemNames`), not per-slot assignments.
4. Patch numbering is set-based ("18.1"), not the "16.1" the seeded fixtures guessed. Cosmetic, but seeds should be updated when the real fetcher lands so tests read true.
5. Community Dragon quirk: `sets["18"].name` reads "Set10" (stale label upstream). Select the set by key `"18"` or by `setData` entry with `mutator: "TFTSet18"`, never by `name`.
6. Comps are clusters recomputed by MetaTFT, so cluster ids shift when their pipeline reruns (ids are prefixed by a `cluster_id` generation, 422 at capture). Comp identity across Refreshes is not stable long-term. The staleness rules in issue 08 should match comps by content (units) rather than trusting ids across patches.
