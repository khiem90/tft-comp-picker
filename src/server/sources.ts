import type {
  BoardSlot,
  Comp,
  PatchChange,
  SetAugment,
  SetDataResponse,
  SetItem,
  SetUnit,
  Tier,
} from "../shared/types";

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
const CDRAGON_URL = "https://raw.communitydragon.org/latest/cdragon/tft/en_us.json";

// A hanging source must degrade like an erroring one (spec story 22): without
// a deadline, a stalled host would block every request that awaits a Refresh.
// 60s leaves room for Community Dragon's 24 MB payload on a slow link.
const FETCH_TIMEOUT_MS = 60_000;

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
  name: MetaTftNamePart[];
  overall: { count: number; avg: number };
  builds: MetaTftBuild[];
  top_itemNames: Array<{ itemNames: string }>;
  top_augments: unknown[];
}

interface MetaTftCompsData {
  results: { data: { cluster_details: Record<string, MetaTftCluster> } };
}

interface CDragonChampion {
  apiName: string;
  name: string;
  cost: number;
  traits: string[];
}

interface CDragonTrait {
  apiName: string;
  name: string;
}

interface CDragonItem {
  apiName: string;
  name: string;
  composition: string[];
  isAugment: boolean;
  associatedTraits: string[];
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

function resolveNames(apis: string[], names: Map<string, string>): string[] {
  return apis
    .map((api) => names.get(api))
    .filter((name): name is string => name !== undefined);
}

export interface TransformedData {
  compsFile: CompsFile;
  setData: SetDataResponse;
}

export function transformSources(
  payloads: SourcePayloads,
  refreshedAt: string,
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
  const traitNames = new Map(set.traits.map((trait) => [trait.apiName, trait.name]));
  const itemNames = new Map(cdragon.items.map((item) => [item.apiName, item.name]));
  // Same filter as setData.augments below, so a Comp can never carry an
  // augment the picker cannot offer.
  const augmentApis = new Set(
    cdragon.items
      .filter((item) => item.apiName.startsWith("DA_") && item.isAugment)
      .map((item) => item.apiName),
  );

  const units: SetUnit[] = set.champions
    .filter((champ) => champ.traits.length > 0)
    .map((champ) => ({ name: champ.name, cost: champ.cost, traits: champ.traits }))
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

  const componentName = (api: string): string => itemNames.get(api) ?? api;
  const items: SetItem[] = cdragon.items
    .filter(
      (item) =>
        item.apiName.startsWith("DA_") &&
        !item.isAugment &&
        item.composition.length > 0,
    )
    .map((item) => ({
      name: item.name,
      components: item.composition.map(componentName),
    }))
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
    items,
    augments,
  };

  const comps: Comp[] = Object.entries(compsData.results.data.cluster_details)
    .map(([id, cluster]) => {
      const buildsByUnit = new Map<string, string[]>();
      for (const build of cluster.builds) {
        // builds also list headliner variants that are not on this board; and
        // the first entry per unit is its top build.
        if (!buildsByUnit.has(build.unit)) {
          buildsByUnit.set(build.unit, resolveNames(build.buildName, itemNames));
        }
      }

      const board: BoardSlot[] = cluster.units_string
        .split(", ")
        .flatMap((unitApi) => {
          const champ = championsByApi.get(unitApi);
          if (!champ) return [];
          return [
            {
              unit: champ.name,
              cost: champ.cost,
              items: buildsByUnit.get(unitApi) ?? [],
            },
          ];
        });

      const name = cluster.name
        .map((part) =>
          part.type === "trait"
            ? (traitNames.get(part.name) ?? part.name)
            : (championsByApi.get(part.name)?.name ?? part.name),
        )
        .join(" ");

      // The Fit item pool is top_itemNames plus every carry's best-in-slot
      // build (recon gap 3): a held build item earns credit even when it
      // misses the cluster-wide top list.
      const topItems = resolveNames(
        cluster.top_itemNames.map((entry) => entry.itemNames),
        itemNames,
      );
      const buildItems = cluster.builds.flatMap((build) =>
        resolveNames(build.buildName, itemNames),
      );
      const itemPriorities = [...new Set([...topItems, ...buildItems])];

      const compAugments = augmentIds(cluster.top_augments ?? [])
        .filter((api) => augmentApis.has(api))
        .map((api) => itemNames.get(api)!);

      const comp: Comp = {
        id,
        name,
        tier: tierFor(cluster.overall.avg),
        board,
        itemPriorities,
      };
      if (compAugments.length > 0) comp.augments = compAugments;
      return { comp, avg: cluster.overall.avg };
    })
    .sort((a, b) => a.avg - b.avg)
    .map(({ comp }) => comp);

  return {
    compsFile: { patch, refreshedAt, source: "metatft", comps },
    setData,
  };
}
