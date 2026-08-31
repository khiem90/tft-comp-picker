import type {
  BoardHex,
  BoardSlot,
  Comp,
  CompTrait,
  LayoutProvenance,
  PatchChange,
  SetAugment,
  SetComponent,
  SetDataResponse,
  SetItem,
  SetTrait,
  SetUnit,
  Tier,
} from "../shared/types";
import type { IconJob } from "./icons";

// The payloads a Refresh needs, exactly as the sources answer them. The
// fetcher is the injected boundary from the spec: the live implementation and
// a test fixture are interchangeable.
export interface SourcePayloads {
  patch: unknown;
  compsData: unknown;
  cdragon: unknown;
}

export interface SourceFetcher {
  fetchSources(): Promise<SourcePayloads>;
  // Fetches one cluster's comp-details payload, the per-unit cell statistics
  // behind source-placed boards. generation is the source's generation
  // counter, read from the comps payload of the same Refresh: cluster ids
  // rotate with it, so a generation fetched separately could describe a
  // different cluster set. Optional so ranking-only fetchers keep working;
  // without it every board falls to the heuristic.
  fetchCompDetails?(compId: string, generation: number): Promise<unknown>;
  // Fetches one icon's bytes by its game-relative .png path. Optional so
  // ranking-only fetchers (and data written before icons existed) keep
  // working; without it a Refresh downloads nothing and the payload simply
  // carries no icon references.
  fetchIcon?(sourcePath: string): Promise<Uint8Array>;
}

export interface CompsFile {
  patch: string;
  refreshedAt: string;
  source: string;
  // Present only when the Refresh that wrote this file crossed a Patch
  // boundary; the next same-Patch Refresh writes a file without it.
  patchChange?: PatchChange;
  comps: Comp[];
}

// Endpoints recorded in .scratch/comp-picker-mvp/source-recon.md (issue 02).
// api.metatft.com 404s on the same paths; only api-hc works.
const METATFT_PATCH_URL = "https://api-hc.metatft.com/tft-stat-api/patch";
const METATFT_COMPS_URL =
  "https://api-hc.metatft.com/tft-comps-api/comps_data?queue=1100";
// Per-cluster details: positions among other stats. Verified live: both
// query params are required, and the same api-hc host answers where
// api.metatft.com 404s.
const METATFT_COMP_DETAILS_URL = "https://api-hc.metatft.com/tft-comps-api/comp_details";
const CDRAGON_URL = "https://raw.communitydragon.org/latest/cdragon/tft/en_us.json";
// CommunityDragon mirrors the game's asset tree here, lowercased, with .tex
// textures re-encoded as .png (verified live for all four icon kinds).
const CDRAGON_GAME_URL = "https://raw.communitydragon.org/latest/game/";

// A hanging source must degrade like an erroring one (spec story 22): without
// a deadline, a stalled host would block every request that awaits a Refresh.
// 60s leaves room for Community Dragon's 24 MB payload on a slow link.
const FETCH_TIMEOUT_MS = 60_000;

// Icons are small PNGs and each failure only costs a fallback tile, so they
// get a much shorter leash than the JSON payloads a Refresh cannot live
// without.
const ICON_TIMEOUT_MS = 15_000;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  return response.json();
}

export function createLiveFetcher(): SourceFetcher {
  return {
    async fetchSources() {
      const [patch, compsData, cdragon] = await Promise.all([
        fetchJson(METATFT_PATCH_URL),
        fetchJson(METATFT_COMPS_URL),
        fetchJson(CDRAGON_URL),
      ]);
      return { patch, compsData, cdragon };
    },
    // The source's cluster_id query param carries the generation counter,
    // not a cluster id; its comp param is what the app calls the cluster id.
    async fetchCompDetails(compId, generation) {
      return fetchJson(
        `${METATFT_COMP_DETAILS_URL}?comp=${compId}&cluster_id=${generation}`,
      );
    },
    async fetchIcon(sourcePath) {
      const response = await fetch(`${CDRAGON_GAME_URL}${sourcePath}`, {
        signal: AbortSignal.timeout(ICON_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`${sourcePath} answered ${response.status}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

// Internal views of the source payloads, narrowed to the fields the transform
// reads. Verified against recorded fixtures, not documentation (none exists).
interface MetaTftPatch {
  patch: string;
  b_patch_version: string;
}

interface MetaTftBuild {
  unit: string;
  buildName: string[];
}

interface MetaTftNamePart {
  name: string;
  type: "trait" | "unit";
}

interface MetaTftCluster {
  units_string: string;
  traits_string: string;
  // Units players commonly 3-star. Includes strays from cluster
  // classification; only the intersection with units_string is served.
  stars: string[];
  // The leveling archetype; served verbatim as Playstyle.
  levelling: string;
  name: MetaTftNamePart[];
  overall: { count: number; avg: number };
  builds: MetaTftBuild[];
  top_itemNames: Array<{ itemNames: string }>;
  top_augments: unknown[];
}

interface MetaTftCompsData {
  results: {
    data: {
      // The source's generation counter; cluster ids are prefixed by it
      // (422000... under generation 422) and rotate when it moves.
      cluster_id: number;
      cluster_details: Record<string, MetaTftCluster>;
    };
  };
}

// How many details fetches run at once. 53 clusters at ~260 KB each is fine
// for a daily Refresh, but firing all of them simultaneously at the source is
// asking to be throttled; six keeps the burst modest.
const DETAILS_CONCURRENCY = 6;

// Fetches every cluster's comp-details payload, keyed by cluster id, reusing
// the generation id from the comps payload of this same Refresh. A cluster
// whose fetch fails is simply absent: its Comp keeps the heuristic board and
// the Refresh itself never fails on details.
export async function fetchAllCompDetails(
  fetcher: SourceFetcher,
  compsData: unknown,
): Promise<Record<string, unknown>> {
  const fetchDetails = fetcher.fetchCompDetails?.bind(fetcher);
  if (!fetchDetails) return {};
  const data = (compsData as Partial<MetaTftCompsData> | null)?.results?.data;
  const generation = data?.cluster_id;
  const clusterIds = Object.keys(data?.cluster_details ?? {});
  if (typeof generation !== "number" || clusterIds.length === 0) return {};
  const details: Record<string, unknown> = {};
  for (let start = 0; start < clusterIds.length; start += DETAILS_CONCURRENCY) {
    await Promise.all(
      clusterIds.slice(start, start + DETAILS_CONCURRENCY).map(async (id) => {
        try {
          details[id] = await fetchDetails(id, generation);
        } catch {
          // This Comp serves its heuristic board.
        }
      }),
    );
  }
  return details;
}

interface CDragonChampion {
  apiName: string;
  name: string;
  cost: number;
  traits: string[];
  // The square tile texture ("..._square.tex"); the icon/squareIcon fields
  // are splash art, which the spec keeps out of scope.
  tileIcon?: string;
  // Combat archetype ("APTank", "ADCaster", ...). null on 72 of the 74
  // recorded playable units (verified live too), so it can only steer the
  // Board layout where it exists; attack range carries the rest.
  role?: string | null;
  stats?: { range?: number };
}

interface CDragonTrait {
  apiName: string;
  name: string;
  icon?: string;
  // The breakpoint ladder, lowest first. MetaTFT's traits_string indexes
  // into it 1-based. minUnits is null on breakpoint-less special traits
  // (recorded: DA_18_Eclipse).
  effects?: Array<{ minUnits: number | null }>;
}

interface CDragonItem {
  apiName: string;
  name: string;
  composition: string[];
  isAugment: boolean;
  associatedTraits: string[];
  icon?: string;
}

interface CDragonPayload {
  items: CDragonItem[];
  sets: Record<string, { champions: CDragonChampion[]; traits: CDragonTrait[] }>;
}

// Tier is derived, not served: MetaTFT computes tier letters client-side from
// placement stats (recon gap 1). Bucketing on average placement keeps a
// Comp's Tier meaningful on its own terms: 4.5 is a dead-average finish, so
// the thresholds hug it, and a Comp's Tier cannot shift just because other
// clusters entered or left the pool.
function tierFor(avgPlacement: number): Tier {
  if (avgPlacement <= 4.35) return "S";
  if (avgPlacement <= 4.65) return "A";
  if (avgPlacement <= 4.95) return "B";
  if (avgPlacement <= 5.35) return "C";
  return "D";
}

// top_augments has been empty on every cluster since capture, so its populated
// shape is a guess. Accept plain id strings and objects keyed like the
// neighbouring top_itemNames list; drop anything unrecognized.
function augmentIds(topAugments: unknown[]): string[] {
  const ids: string[] = [];
  for (const entry of topAugments) {
    if (typeof entry === "string") {
      ids.push(entry);
    } else if (entry !== null && typeof entry === "object") {
      const { itemNames } = entry as Record<string, unknown>;
      if (typeof itemNames === "string") ids.push(itemNames);
    }
  }
  return ids;
}

// Decodes MetaTFT's traits_string ("DA_18_Fae_2, ...") against the Set data
// breakpoint ladders. The trailing number is a 1-based index into the trait's
// minUnits list, not a unit count, and the split must happen on the last
// underscore because apiNames themselves contain underscores and digits.
// Undecodable entries are dropped: better a missing chip than a made-up
// count. Never tally the Comp's unit list instead; it misses emblems.
function decodeTraits(
  traitsString: string,
  traitsByApi: Map<string, CDragonTrait>,
): CompTrait[] {
  return traitsString
    .split(",")
    .map((entry) => entry.trim())
    .flatMap((entry) => {
      const separator = entry.lastIndexOf("_");
      if (separator === -1) return [];
      const trait = traitsByApi.get(entry.slice(0, separator));
      const indexPart = entry.slice(separator + 1);
      if (!trait || !/^\d+$/.test(indexPart)) return [];
      const minUnits = trait.effects?.[Number(indexPart) - 1]?.minUnits;
      // null happens (DA_18_Eclipse's one breakpoint has minUnits: null), so
      // anything non-numeric drops the chip.
      if (typeof minUnits !== "number") return [];
      return [{ name: trait.name, apiName: trait.apiName, count: minUnits }];
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function resolveNames(apis: string[], names: Map<string, string>): string[] {
  return apis
    .map((api) => names.get(api))
    .filter((name): name is string => name !== undefined);
}

// An item reference keeps display name and apiName together so the payload's
// parallel arrays can never drift out of alignment.
interface ItemRef {
  name: string;
  apiName: string;
}

function resolveItemRefs(apis: string[], names: Map<string, string>): ItemRef[] {
  return apis.flatMap((api) => {
    const name = names.get(api);
    return name === undefined ? [] : [{ name, apiName: api }];
  });
}

// Converts an upstream texture path into the game-relative .png path
// CommunityDragon serves (lowercased tree, .tex re-encoded as .png). Returns
// null when there is nothing honest to download: no path, an extension the
// convention was never verified for, or an upstream placeholder, whose
// assets live under "missing"-prefixed path segments (e.g. missing-t2).
function iconSourcePath(texPath: string | undefined): string | null {
  if (!texPath) return null;
  const lowered = texPath.toLowerCase();
  if (!lowered.endsWith(".tex")) return null;
  if (lowered.split("/").some((segment) => segment.startsWith("missing"))) return null;
  return `${lowered.slice(0, -".tex".length)}.png`;
}

// Board layout derivation. Where the comp-details data covers a unit, it
// stands on its most-played cell; everything else falls to the heuristic:
// tanks and bruisers hold the front rows, carries and casters the back rows.
// CommunityDragon's role field decides where it exists, but it is null on
// almost every playable unit (72 of 74, live and recorded alike), so null
// roles fall back to attack range: melee units front, ranged units back.
function isFrontline(champ: CDragonChampion): boolean {
  if (champ.role) return /tank|bruiser/i.test(champ.role);
  return (champ.stats?.range ?? 1) <= 1;
}

// The source numbers cells from the player's back row, left to right: cell_1
// is the back row's left corner, cell_28 the front row's right edge. The
// app's Board layout puts row 0 at the front, so the row flips on the way in.
function cellToHex(cell: unknown): BoardHex | null {
  if (typeof cell !== "string") return null;
  const match = /^cell_(\d+)$/.exec(cell);
  if (match === null) return null;
  const index = Number(match[1]) - 1;
  if (index < 0 || index >= 28) return null;
  return { row: 3 - Math.floor(index / 7), col: index % 7 };
}

// One unit's played cells from a comp-details payload, best first, as app
// hexes. Access is defensive at every step because the payload is a raw
// source answer: anything malformed yields no cells, which lands the unit on
// the heuristic exactly like a failed fetch.
function sourceCellRanking(details: unknown, apiName: string): BoardHex[] {
  const units = (
    details as {
      results?: {
        positioning?: { units?: Record<string, { positions?: unknown }> };
      };
    } | null
  )?.results?.positioning?.units;
  const positions = units?.[apiName]?.positions;
  if (!Array.isArray(positions)) return [];
  return positions
    .filter(
      (entry): entry is { cell: unknown; count: number } =>
        entry !== null &&
        typeof entry === "object" &&
        typeof (entry as { count?: unknown }).count === "number",
    )
    .sort((a, b) => b.count - a.count)
    .flatMap((entry) => {
      const hex = cellToHex(entry.cell);
      return hex === null ? [] : [hex];
    });
}

// Hexes walk the line's outermost row center-out (col 3 first, then
// alternating outward), spilling onto the inner row only when the outer one
// fills. Rows 0/1 are the front line, rows 3/2 the back line. Hexes already
// taken by source-placed units are skipped.
const CENTER_OUT_COLS = [3, 2, 4, 1, 5, 0, 6];

const hexKey = (hex: BoardHex): string => `${hex.row},${hex.col}`;

function lineHexes(rows: number[], count: number, occupied: Set<string>): BoardHex[] {
  const hexes: BoardHex[] = [];
  for (const row of rows) {
    for (const col of CENTER_OUT_COLS) {
      if (hexes.length === count) return hexes;
      if (occupied.has(hexKey({ row, col }))) continue;
      hexes.push({ row, col });
    }
  }
  return hexes;
}

// The placement walk MetaTFT's own site runs: units in source order, each on
// its highest-count cell still free. Units the data misses, and units whose
// cells are all taken, fall to the heuristic within their line. Returns the
// Comp's layout provenance: "source" only when every unit was source-placed.
function placeBoard(
  board: BoardSlot[],
  championsByApi: Map<string, CDragonChampion>,
  details: unknown,
): LayoutProvenance {
  const occupied = new Set<string>();
  const fallback: BoardSlot[] = [];
  for (const slot of board) {
    const hex = sourceCellRanking(details, slot.apiName).find(
      (candidate) => !occupied.has(hexKey(candidate)),
    );
    if (hex === undefined) {
      fallback.push(slot);
      continue;
    }
    slot.position = hex;
    occupied.add(hexKey(hex));
  }

  const front: BoardSlot[] = [];
  const back: BoardSlot[] = [];
  for (const slot of fallback) {
    (isFrontline(championsByApi.get(slot.apiName)!) ? front : back).push(slot);
  }
  const frontHexes = lineHexes([0, 1], front.length, occupied);
  const backHexes = lineHexes([3, 2], back.length, occupied);
  front.forEach((slot, index) => {
    slot.position = frontHexes[index];
  });
  back.forEach((slot, index) => {
    slot.position = backHexes[index];
  });
  return board.length > 0 && fallback.length === 0 ? "source" : "heuristic";
}

export interface TransformedData {
  compsFile: CompsFile;
  setData: SetDataResponse;
  // Every icon the Refresh should hold locally for this Patch. The transform
  // only names them; downloading (and deciding which references survive) is
  // syncIcons' job.
  iconJobs: IconJob[];
}

export function transformSources(
  payloads: SourcePayloads,
  refreshedAt: string,
  // Comp-details payloads keyed by cluster id, from fetchAllCompDetails. A
  // missing entry means that Comp keeps its heuristic board.
  compDetails: Record<string, unknown> = {},
): TransformedData {
  const patchInfo = payloads.patch as MetaTftPatch;
  const compsData = payloads.compsData as MetaTftCompsData;
  const cdragon = payloads.cdragon as CDragonPayload;

  // "18.1", plus a B-patch marker when one is live. b_patch_version has only
  // ever been recorded empty, so its populated format is unknown; forcing the
  // "b" prefix keeps "18.1b" and "18.1b1" both unambiguous. Selecting the set
  // by key "18" is deliberate: sets["18"].name reads "Set10" upstream (recon
  // gap 5), so names are never trusted for identity.
  const bPatch = patchInfo.b_patch_version;
  const patch =
    bPatch === "" ? patchInfo.patch : `${patchInfo.patch}b${bPatch.replace(/^b/i, "")}`;
  const set = cdragon.sets["18"];
  if (!set) throw new Error("Community Dragon payload has no Set 18 entry");

  const championsByApi = new Map(set.champions.map((champ) => [champ.apiName, champ]));
  const traitsByApi = new Map(set.traits.map((trait) => [trait.apiName, trait]));
  const traitNames = new Map(set.traits.map((trait) => [trait.apiName, trait.name]));
  const itemNames = new Map(cdragon.items.map((item) => [item.apiName, item.name]));
  const itemsByApi = new Map(cdragon.items.map((item) => [item.apiName, item]));

  const iconJobs: IconJob[] = [];
  const addIconJob = (
    kind: IconJob["kind"],
    apiName: string,
    texPath: string | undefined,
  ): void => {
    const sourcePath = iconSourcePath(texPath);
    // apiName becomes a file name on disk; anything outside the identifier
    // alphabet is refused rather than escaped.
    if (sourcePath === null || !/^[A-Za-z0-9_.-]+$/.test(apiName)) return;
    iconJobs.push({ kind, apiName, sourcePath });
  };
  // Same filter as setData.augments below, so a Comp can never carry an
  // augment the picker cannot offer.
  const augmentApis = new Set(
    cdragon.items
      .filter((item) => item.apiName.startsWith("DA_") && item.isAugment)
      .map((item) => item.apiName),
  );

  const units: SetUnit[] = set.champions
    .filter((champ) => champ.traits.length > 0)
    .map((champ) => {
      addIconJob("units", champ.apiName, champ.tileIcon);
      return {
        name: champ.name,
        apiName: champ.apiName,
        cost: champ.cost,
        traits: champ.traits,
      };
    })
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

  const traits: SetTrait[] = set.traits
    .map((trait) => {
      addIconJob("traits", trait.apiName, trait.icon);
      return { name: trait.name, apiName: trait.apiName };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const componentName = (api: string): string => itemNames.get(api) ?? api;
  const items: SetItem[] = cdragon.items
    .filter(
      (item) =>
        item.apiName.startsWith("DA_") &&
        !item.isAugment &&
        item.composition.length > 0,
    )
    .map((item) => {
      addIconJob("items", item.apiName, item.icon);
      return {
        name: item.name,
        apiName: item.apiName,
        components: item.composition.map(componentName),
        componentApiNames: item.composition,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Components are Holdings in their own right, and their icons have no other
  // home in the payload: SetItem only names its components.
  const componentApis = [...new Set(items.flatMap((item) => item.componentApiNames))];
  const components: SetComponent[] = componentApis
    .map((api) => {
      addIconJob("components", api, itemsByApi.get(api)?.icon);
      return { name: componentName(api), apiName: api };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const augments: SetAugment[] = cdragon.items
    .filter((item) => item.apiName.startsWith("DA_") && item.isAugment)
    .map((item) => ({
      name: item.name,
      traits: resolveNames(item.associatedTraits, traitNames),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const setData: SetDataResponse = {
    patch,
    setNumber: 18,
    setName: "Set 18",
    units,
    traits,
    items,
    components,
    augments,
  };

  const comps: Comp[] = Object.entries(compsData.results.data.cluster_details)
    .map(([id, cluster]) => {
      const buildsByUnit = new Map<string, ItemRef[]>();
      for (const build of cluster.builds) {
        // builds also list headliner variants that are not on this board; and
        // the first entry per unit is its top build.
        if (!buildsByUnit.has(build.unit)) {
          buildsByUnit.set(build.unit, resolveItemRefs(build.buildName, itemNames));
        }
      }

      const board: BoardSlot[] = cluster.units_string
        .split(", ")
        .flatMap((unitApi) => {
          const champ = championsByApi.get(unitApi);
          if (!champ) return [];
          const buildRefs = buildsByUnit.get(unitApi) ?? [];
          return [
            {
              unit: champ.name,
              apiName: champ.apiName,
              cost: champ.cost,
              items: buildRefs.map((ref) => ref.name),
              itemApiNames: buildRefs.map((ref) => ref.apiName),
            },
          ];
        });

      // Only resolvable units reach the board, so every slot has a champion
      // to read role and range from. The board stays the authoritative unit
      // list: cells are looked up per board unit, so the summons and monsters
      // the details payload also carries never reach it.
      const layoutProvenance = placeBoard(board, championsByApi, compDetails[id]);

      // Core Units are the builds units still on this board; builds also
      // list headliner variants the board never fields. Board membership
      // doubles as name resolution, since only resolvable units reach it.
      const boardApiNames = new Set(board.map((slot) => slot.apiName));
      const coreUnits = [...buildsByUnit.keys()].filter((api) => boardApiNames.has(api));
      const starTargets = (cluster.stars ?? []).filter((api) => boardApiNames.has(api));

      const name = cluster.name
        .map((part) =>
          part.type === "trait"
            ? (traitNames.get(part.name) ?? part.name)
            : (championsByApi.get(part.name)?.name ?? part.name),
        )
        .join(" ");

      // The Fit item pool is top_itemNames plus every carry's best-in-slot
      // build (recon gap 3): a held build item earns credit even when it
      // misses the cluster-wide top list. Dedup stays keyed by display name
      // (the first apiName behind a name wins) so the visible list is exactly
      // what it was before apiNames rode along.
      const topRefs = resolveItemRefs(
        cluster.top_itemNames.map((entry) => entry.itemNames),
        itemNames,
      );
      const buildRefs = cluster.builds.flatMap((build) =>
        resolveItemRefs(build.buildName, itemNames),
      );
      const seenPriorities = new Set<string>();
      const priorityRefs: ItemRef[] = [];
      for (const ref of [...topRefs, ...buildRefs]) {
        if (seenPriorities.has(ref.name)) continue;
        seenPriorities.add(ref.name);
        priorityRefs.push(ref);
      }

      const compAugments = augmentIds(cluster.top_augments ?? [])
        .filter((api) => augmentApis.has(api))
        .map((api) => itemNames.get(api)!);

      const comp: Comp = {
        id,
        name,
        tier: tierFor(cluster.overall.avg),
        traits: decodeTraits(cluster.traits_string, traitsByApi),
        playstyle: cluster.levelling,
        board,
        coreUnits,
        starTargets,
        itemPriorities: priorityRefs.map((ref) => ref.name),
        itemPriorityApiNames: priorityRefs.map((ref) => ref.apiName),
        layoutProvenance,
      };
      if (compAugments.length > 0) comp.augments = compAugments;
      return { comp, avg: cluster.overall.avg };
    })
    .sort((a, b) => a.avg - b.avg)
    .map(({ comp }) => comp);

  return {
    compsFile: { patch, refreshedAt, source: "metatft", comps },
    setData,
    iconJobs,
  };
}
