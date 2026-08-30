import { describe, expect, it } from "vitest";
import {
  clearActiveGame,
  loadActiveGame,
  saveActiveGame,
} from "../src/ui/activeGame";

// In-memory stand-in for window.localStorage.
function fakeStorage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
}

describe("Active game persistence", () => {
  it("restores saved Holdings after a reload", () => {
    const storage = fakeStorage();
    const holdings = {
      units: ["Fenwick", "Kaelen"],
      items: ["Recurve Bow", "Recurve Bow"],
      augments: ["Wild Growth"],
    };

    saveActiveGame(storage, holdings);

    expect(loadActiveGame(storage)).toEqual(holdings);
  });

  it("starts a fresh browser with empty Holdings", () => {
    const storage = fakeStorage();

    expect(loadActiveGame(storage)).toEqual({ units: [], items: [], augments: [] });
  });

  it("discards the previous game entirely when a new game starts", () => {
    const storage = fakeStorage();
    saveActiveGame(storage, { units: ["Grib"], items: ["Warmog's Armor"], augments: [] });

    clearActiveGame(storage);

    expect(loadActiveGame(storage)).toEqual({ units: [], items: [], augments: [] });
  });

  it("treats a corrupt saved game as no game rather than crashing", () => {
    const corrupt = fakeStorage({ "tft-comp-picker.active-game": "{not json" });
    const wrongShape = fakeStorage({
      "tft-comp-picker.active-game": JSON.stringify({ units: "Grib", extra: 1 }),
    });

    expect(loadActiveGame(corrupt)).toEqual({ units: [], items: [], augments: [] });
    expect(loadActiveGame(wrongShape)).toEqual({ units: [], items: [], augments: [] });
  });

  it("keeps the app alive when the browser refuses storage access", () => {
    const refusing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };

    expect(loadActiveGame(refusing)).toEqual({ units: [], items: [], augments: [] });
    expect(() =>
      saveActiveGame(refusing, { units: ["Grib"], items: [], augments: [] }),
    ).not.toThrow();
    expect(() => clearActiveGame(refusing)).not.toThrow();
  });
});
