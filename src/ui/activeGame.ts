// The Active game's Holdings, persisted in browser storage so a reload
// mid-game loses nothing. One saved game, no history (see CONTEXT.md).
export interface ActiveGameHoldings {
  units: string[];
  items: string[];
  augments: string[];
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_KEY = "tft-comp-picker.active-game";

// Storage can refuse access (private mode, quota, blocked embeds). Losing
// persistence is fine then; taking the app down with it is not.
export function saveActiveGame(storage: StorageLike, holdings: ActiveGameHoldings): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  } catch {
    // the game continues unpersisted
  }
}

function emptyHoldings(): ActiveGameHoldings {
  return { units: [], items: [], augments: [] };
}

function isNameList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

// A corrupt or outdated saved game reads as no game; the alternative is an
// app that crashes on every load until the player finds devtools.
export function loadActiveGame(storage: StorageLike): ActiveGameHoldings {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return emptyHoldings();
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object") {
      const { units, items, augments } = parsed as Record<string, unknown>;
      if (isNameList(units) && isNameList(items) && isNameList(augments)) {
        return { units, items, augments };
      }
    }
  } catch {
    // fall through to the empty game
  }
  return emptyHoldings();
}

export function clearActiveGame(storage: StorageLike): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // nothing was persisted to clear
  }
}
