import { describe, expect, it, vi } from "vitest";

// Mock db before importing (user-affinity.ts imports db at module level)
vi.mock("@/lib/db", () => ({ db: {} }));

import type { MediaType } from "@/lib/db/types";
import type { AffinityEntry } from "@/lib/predictions/types";
import {
  addToAffinityMap,
  processRow,
  toDecade,
  toRuntimeBucket,
} from "@/lib/predictions/user-affinity";

describe("toDecade", () => {
  it("floors year to nearest decade", () => {
    expect(toDecade(2023)).toBe(2020);
    expect(toDecade(1999)).toBe(1990);
    expect(toDecade(2000)).toBe(2000);
    expect(toDecade(1985)).toBe(1980);
  });

  it("handles exact decade boundaries", () => {
    expect(toDecade(2020)).toBe(2020);
    expect(toDecade(1990)).toBe(1990);
  });

  it("handles old years", () => {
    expect(toDecade(1927)).toBe(1920);
  });
});

describe("toRuntimeBucket", () => {
  it("returns 'short' for < 100 minutes", () => {
    expect(toRuntimeBucket(90)).toBe("short");
    expect(toRuntimeBucket(99)).toBe("short");
    expect(toRuntimeBucket(1)).toBe("short");
  });

  it("returns 'medium' for 100-150 minutes", () => {
    expect(toRuntimeBucket(100)).toBe("medium");
    expect(toRuntimeBucket(120)).toBe("medium");
    expect(toRuntimeBucket(150)).toBe("medium");
  });

  it("returns 'long' for > 150 minutes", () => {
    expect(toRuntimeBucket(151)).toBe("long");
    expect(toRuntimeBucket(200)).toBe("long");
    expect(toRuntimeBucket(300)).toBe("long");
  });
});

describe("addToAffinityMap", () => {
  it("creates a new entry for an unseen key", () => {
    const map = new Map<string, AffinityEntry>();
    addToAffinityMap(map, "Action", 8);
    expect(map.get("Action")).toEqual({ avg: 8, count: 1 });
  });

  it("computes running average for existing key", () => {
    const map = new Map<string, AffinityEntry>();
    addToAffinityMap(map, "Action", 8);
    addToAffinityMap(map, "Action", 6);
    // (8*1 + 6) / 2 = 7
    expect(map.get("Action")).toEqual({ avg: 7, count: 2 });
  });

  it("handles multiple additions correctly", () => {
    const map = new Map<string, AffinityEntry>();
    addToAffinityMap(map, "Drama", 10);
    addToAffinityMap(map, "Drama", 8);
    addToAffinityMap(map, "Drama", 6);
    // (10 + 8 + 6) / 3 = 8
    expect(map.get("Drama")?.avg).toBeCloseTo(8, 5);
    expect(map.get("Drama")?.count).toBe(3);
  });

  it("tracks separate keys independently", () => {
    const map = new Map<string, AffinityEntry>();
    addToAffinityMap(map, "A", 10);
    addToAffinityMap(map, "B", 4);
    expect(map.get("A")?.avg).toBe(10);
    expect(map.get("B")?.avg).toBe(4);
  });

  it("works with numeric keys", () => {
    const map = new Map<number, AffinityEntry>();
    addToAffinityMap(map, 2020, 7);
    addToAffinityMap(map, 2020, 9);
    expect(map.get(2020)?.avg).toBe(8);
  });
});

function makeMaps() {
  return {
    genre: new Map<string, AffinityEntry>(),
    director: new Map<string, AffinityEntry>(),
    cast: new Map<string, AffinityEntry>(),
    decade: new Map<number, AffinityEntry>(),
    format: new Map<MediaType, AffinityEntry>(),
    runtime: new Map<string, AffinityEntry>(),
  };
}

describe("processRow", () => {
  it("distributes score to all genre maps", () => {
    const maps = makeMaps();
    processRow(
      {
        score: "8",
        media_type: "movie",
        release_year: 2020,
        runtime_minutes: 120,
        genres: ["Action", "Drama"],
        directors: ["Nolan"],
        top_cast: null,
      },
      8,
      maps,
    );

    expect(maps.genre.get("Action")).toEqual({ avg: 8, count: 1 });
    expect(maps.genre.get("Drama")).toEqual({ avg: 8, count: 1 });
  });

  it("populates director map", () => {
    const maps = makeMaps();
    processRow(
      {
        score: "7",
        media_type: "movie",
        release_year: 2020,
        runtime_minutes: 120,
        genres: [],
        directors: ["Spielberg", "Lucas"],
        top_cast: null,
      },
      7,
      maps,
    );

    expect(maps.director.get("Spielberg")).toEqual({ avg: 7, count: 1 });
    expect(maps.director.get("Lucas")).toEqual({ avg: 7, count: 1 });
  });

  it("computes decade from release year", () => {
    const maps = makeMaps();
    processRow(
      {
        score: "9",
        media_type: "movie",
        release_year: 2023,
        runtime_minutes: 120,
        genres: [],
        directors: null,
        top_cast: null,
      },
      9,
      maps,
    );

    expect(maps.decade.get(2020)).toEqual({ avg: 9, count: 1 });
  });

  it("populates format map with media type", () => {
    const maps = makeMaps();
    processRow(
      {
        score: "6",
        media_type: "anime",
        release_year: null,
        runtime_minutes: null,
        genres: [],
        directors: null,
        top_cast: null,
      },
      6,
      maps,
    );

    expect(maps.format.get("anime")).toEqual({ avg: 6, count: 1 });
  });

  it("computes runtime bucket", () => {
    const maps = makeMaps();
    processRow(
      {
        score: "7",
        media_type: "movie",
        release_year: null,
        runtime_minutes: 90,
        genres: [],
        directors: null,
        top_cast: null,
      },
      7,
      maps,
    );

    expect(maps.runtime.get("short")).toEqual({ avg: 7, count: 1 });
  });

  it("skips null fields gracefully", () => {
    const maps = makeMaps();
    processRow(
      {
        score: "5",
        media_type: "tv",
        release_year: null,
        runtime_minutes: null,
        genres: [],
        directors: null,
        top_cast: null,
      },
      5,
      maps,
    );

    expect(maps.decade.size).toBe(0);
    expect(maps.runtime.size).toBe(0);
    expect(maps.director.size).toBe(0);
    expect(maps.format.get("tv")).toEqual({ avg: 5, count: 1 });
  });
});
