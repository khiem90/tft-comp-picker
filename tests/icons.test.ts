import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/server/app";
import type { SourceFetcher, SourcePayloads } from "../src/server/sources";
import type { SetDataResponse } from "../src/shared/types";

const recordedDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "recorded",
);

const NOW = Date.parse("2026-08-30T12:00:00Z");
const now = () => NOW;

function loadRecorded(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(recordedDir, name), "utf8"));
}

function recordedPayloads(): SourcePayloads {
  return {
    patch: loadRecorded("metatft-patch.json"),
    compsData: loadRecorded("metatft-comps_data.json"),
    cdragon: loadRecorded("cdragon-set18.json"),
  };
}

function setPatch(payloads: SourcePayloads, patch: string): void {
  (payloads.patch as { patch: string }).patch = patch;
}

// The refresh-seam fetcher, extended with fake icon bytes: each icon answers
// with bytes derived from its own path, so a test can prove the file on disk
// is the one the fetcher served for that path.
interface IconFetcher extends SourceFetcher {
  iconCalls: string[];
}

function iconBytes(sourcePath: string): Uint8Array {
  return new TextEncoder().encode(`png:${sourcePath}`);
}

function iconFetcher(
  payloads: SourcePayloads = recordedPayloads(),
  failFor: (sourcePath: string) => boolean = () => false,
): IconFetcher {
  return {
    iconCalls: [],
    async fetchSources() {
      return payloads;
    },
    async fetchIcon(sourcePath: string) {
      this.iconCalls.push(sourcePath);
      if (failFor(sourcePath)) throw new Error(`icon fetch failed: ${sourcePath}`);
      return iconBytes(sourcePath);
    },
  };
}

const tempDirs: string[] = [];

function emptyDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tft-icons-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Maps a payload icon URL ("/icons/units/DA_18_Rengar.png") onto the file the
// Refresh should have written under the data directory.
function iconFile(dataDir: string, iconUrl: string): string {
  return path.join(dataDir, ...iconUrl.replace(/^\//, "").split("/"));
}

async function fetchSetData(app: ReturnType<typeof createApp>): Promise<SetDataResponse> {
  const response = await request(app).get("/api/set-data");
  expect(response.status).toBe(200);
  return response.body as SetDataResponse;
}

// Every payload entry that can carry an icon reference.
function iconedEntries(setData: SetDataResponse): Array<{ icon?: string }> {
  return [
    ...setData.units,
    ...setData.traits,
    ...setData.items,
    ...(setData.components ?? []),
  ];
}

describe("Refresh icon downloads", () => {
  it("writes unit, trait, item, and component icons where the payload says", async () => {
    const dataDir = emptyDataDir();
    const app = createApp({ dataDir, fetcher: iconFetcher(), now });

    const setData = await fetchSetData(app);

    const rengar = setData.units.find((unit) => unit.name === "Rengar")!;
    expect(rengar.icon).toBe("/icons/units/DA_18_Rengar.png");
    const fae = setData.traits.find((trait) => trait.name === "Fae")!;
    expect(fae.icon).toBe("/icons/traits/DA_18_Fae.png");
    const guinsoos = setData.items.find((item) => item.name === "Guinsoo's Rageblade")!;
    expect(guinsoos.icon).toBe("/icons/items/DA_GuinsoosRageblade.png");
    const bow = setData.components!.find(
      (component) => component.apiName === "DA_Component_RecurveBow",
    )!;
    expect(bow.name).toBe("Recurve Bow");
    expect(bow.icon).toBe("/icons/components/DA_Component_RecurveBow.png");

    // Every referenced icon is a real local file holding the bytes the
    // fetcher served for that entity's converted source path.
    expect(fs.readFileSync(iconFile(dataDir, rengar.icon!))).toEqual(
      Buffer.from(iconBytes("assets/characters/tft18_rengar/tft18_rengar_square.png")),
    );
    for (const entry of iconedEntries(setData)) {
      expect(entry.icon).toBeTruthy();
      expect(fs.existsSync(iconFile(dataDir, entry.icon!))).toBe(true);
    }
  });

  it("serves the downloaded icons over HTTP so the app renders offline", async () => {
    const dataDir = emptyDataDir();
    const app = createApp({ dataDir, fetcher: iconFetcher(), now });

    const setData = await fetchSetData(app);

    const rengar = setData.units.find((unit) => unit.name === "Rengar")!;
    const served = await request(app).get(rengar.icon!);
    expect(served.status).toBe(200);
    expect(served.body).toEqual(
      Buffer.from(iconBytes("assets/characters/tft18_rengar/tft18_rengar_square.png")),
    );

    // No render-time CDN: every icon reference is a local path, never a URL
    // onto a third-party host.
    for (const entry of iconedEntries(setData)) {
      expect(entry.icon).toMatch(/^\/icons\//);
    }
  });

  it("converts CommunityDragon .tex paths to lowercased .png paths", async () => {
    const fetcher = iconFetcher();
    const app = createApp({ dataDir: emptyDataDir(), fetcher, now });

    await fetchSetData(app);

    // 74 units + 36 traits + 55 items + 10 components in the recorded payload.
    expect(fetcher.iconCalls.length).toBe(175);
    expect(fetcher.iconCalls).toContain(
      "assets/characters/tft18_rengar/tft18_rengar_square.png",
    );
    expect(fetcher.iconCalls).toContain("assets/ux/traiticons/trait_icon_18_fae.png");
    expect(fetcher.iconCalls).toContain(
      "assets/maps/tft/icons/items/hexcore/tft_item_guinsoosrageblade.png",
    );
    for (const call of fetcher.iconCalls) {
      expect(call).toBe(call.toLowerCase());
      expect(call.endsWith(".png")).toBe(true);
    }
  });

  it("degrades a failed icon fetch to an absent reference without failing the Refresh", async () => {
    const dataDir = emptyDataDir();
    const fetcher = iconFetcher(recordedPayloads(), (sourcePath) =>
      sourcePath.includes("tft18_rengar_square"),
    );
    const app = createApp({ dataDir, fetcher, now });

    const comps = await request(app).get("/api/comps");
    expect(comps.status).toBe(200);
    expect(comps.body.patch).toBe("18.1");
    expect(comps.body.refreshError).toBeNull();

    const setData = await fetchSetData(app);
    const rengar = setData.units.find((unit) => unit.name === "Rengar")!;
    expect(rengar.icon).toBeUndefined();
    expect(fs.existsSync(path.join(dataDir, "icons", "units", "DA_18_Rengar.png"))).toBe(
      false,
    );
    // The failure is that one icon's, not the Refresh's: neighbours still land.
    const kobuko = setData.units.find((unit) => unit.name === "Kobuko")!;
    expect(kobuko.icon).toBeTruthy();
  });

  it("leaves every icon reference absent when the fetcher cannot fetch icons", async () => {
    // Fetchers predating icons (and tests exercising only ranking) have no
    // fetchIcon; the Refresh must still succeed and the payload must not
    // promise files nothing downloaded.
    const fetcher: SourceFetcher = {
      async fetchSources() {
        return recordedPayloads();
      },
    };
    const app = createApp({ dataDir: emptyDataDir(), fetcher, now });

    const setData = await fetchSetData(app);

    for (const entry of iconedEntries(setData)) {
      expect(entry.icon).toBeUndefined();
    }
  });

  it("does not re-download icons a same-Patch Refresh already has", async () => {
    const dataDir = emptyDataDir();
    const fetcher = iconFetcher();
    const app = createApp({ dataDir, fetcher, now });
    await fetchSetData(app);
    const firstCount = fetcher.iconCalls.length;

    const refresh = await request(app).post("/api/refresh");

    expect(refresh.status).toBe(200);
    expect(fetcher.iconCalls.length).toBe(firstCount);
    const setData = await fetchSetData(app);
    expect(setData.units.find((unit) => unit.name === "Rengar")!.icon).toBeTruthy();
  });

  it("retries a previously failed icon on the next same-Patch Refresh", async () => {
    const dataDir = emptyDataDir();
    let failing = true;
    const fetcher = iconFetcher(recordedPayloads(), (sourcePath) =>
      failing && sourcePath.includes("tft18_rengar_square"),
    );
    const app = createApp({ dataDir, fetcher, now });
    await fetchSetData(app);

    failing = false;
    await request(app).post("/api/refresh");

    const setData = await fetchSetData(app);
    expect(setData.units.find((unit) => unit.name === "Rengar")!.icon).toBe(
      "/icons/units/DA_18_Rengar.png",
    );
  });

  it("replaces surviving icons when no comps.json says what Patch they are", async () => {
    const dataDir = emptyDataDir();
    // Icon files from an earlier run outlived their comps.json (crash,
    // manual deletion). Their Patch is unknowable, so they are stale Set
    // data and the Refresh must replace them instead of trusting them.
    const orphan = path.join(dataDir, "icons", "units", "DA_18_Rengar.png");
    fs.mkdirSync(path.dirname(orphan), { recursive: true });
    fs.writeFileSync(orphan, "bytes from an unknown Patch");
    const fetcher = iconFetcher();
    const app = createApp({ dataDir, fetcher, now });

    await fetchSetData(app);

    expect(fetcher.iconCalls).toContain(
      "assets/characters/tft18_rengar/tft18_rengar_square.png",
    );
    expect(fs.readFileSync(orphan)).toEqual(
      Buffer.from(iconBytes("assets/characters/tft18_rengar/tft18_rengar_square.png")),
    );
  });

  it("replaces all icons when a Refresh crosses a Patch boundary", async () => {
    const dataDir = emptyDataDir();
    const first = iconFetcher();
    await fetchSetData(createApp({ dataDir, fetcher: first, now }));

    const nextPayloads = recordedPayloads();
    setPatch(nextPayloads, "18.2");
    const second = iconFetcher(nextPayloads);
    const app = createApp({ dataDir, fetcher: second, now });
    const refresh = await request(app).post("/api/refresh");

    expect(refresh.status).toBe(200);
    expect(refresh.body.patch).toBe("18.2");
    // Icons are Set data: the Patch change staled them all, so the new
    // Refresh downloads the full set again instead of trusting old files.
    expect(second.iconCalls.length).toBe(first.iconCalls.length);
    const setData = await fetchSetData(app);
    expect(setData.units.find((unit) => unit.name === "Rengar")!.icon).toBeTruthy();
  });

  it("skips upstream placeholder icon paths instead of downloading them", async () => {
    const payloads = recordedPayloads();
    const cdragon = payloads.cdragon as {
      sets: Record<string, { champions: Array<{ apiName: string; tileIcon: string }> }>;
    };
    const rengar = cdragon.sets["18"].champions.find(
      (champ) => champ.apiName === "DA_18_Rengar",
    )!;
    rengar.tileIcon = "assets/characters/missing-t2/missing-t2_square.tex";
    const fetcher = iconFetcher(payloads);
    const app = createApp({ dataDir: emptyDataDir(), fetcher, now });

    const setData = await fetchSetData(app);

    expect(setData.units.find((unit) => unit.name === "Rengar")!.icon).toBeUndefined();
    expect(
      fetcher.iconCalls.filter((call) => call.includes("missing-t2")),
    ).toEqual([]);
  });
});
