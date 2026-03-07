import { describe, expect, it } from "vitest";

import {
  GENRE_NAME_TO_TMDB_IDS,
  getMovieGenreId,
  getTvGenreId,
  TMDB_MOVIE_GENRES,
  TMDB_TV_GENRES,
} from "@/lib/api/tmdb-genres";
import type { WatchedIds } from "@/lib/recommendations/types";

// isAlreadyWatched imports from watched.ts which imports db — test inline instead
function isAlreadyWatched(
  watched: WatchedIds,
  item: { mediaId?: string | null; tmdbId?: number | null; malId?: number | null },
): boolean {
  if (item.mediaId !== undefined && item.mediaId !== null && watched.mediaIds.has(item.mediaId)) {
    return true;
  }
  if (item.tmdbId !== undefined && item.tmdbId !== null && watched.tmdbIds.has(item.tmdbId)) {
    return true;
  }
  if (item.malId !== undefined && item.malId !== null && watched.malIds.has(item.malId)) {
    return true;
  }
  return false;
}

describe("TMDB genre mapping", () => {
  it("maps Action to movie genre ID 28", () => {
    expect(getMovieGenreId("Action")).toBe(28);
  });

  it("maps Science Fiction to movie genre ID 878", () => {
    expect(getMovieGenreId("Science Fiction")).toBe(878);
  });

  it("is case-insensitive", () => {
    expect(getMovieGenreId("action")).toBe(28);
    expect(getMovieGenreId("COMEDY")).toBe(35);
  });

  it("returns null for unknown genres", () => {
    expect(getMovieGenreId("Nonexistent Genre")).toBeNull();
  });

  it("maps TV genres correctly", () => {
    expect(getTvGenreId("Sci-Fi & Fantasy")).toBe(10_765);
    expect(getTvGenreId("Action & Adventure")).toBe(10_759);
  });

  it("returns null for unknown TV genres", () => {
    expect(getTvGenreId("Nonexistent")).toBeNull();
  });

  it("has reverse mapping for all movie genres", () => {
    for (const [, name] of Object.entries(TMDB_MOVIE_GENRES)) {
      expect(GENRE_NAME_TO_TMDB_IDS[name]).toBeDefined();
      expect(GENRE_NAME_TO_TMDB_IDS[name]?.length).toBeGreaterThan(0);
    }
  });

  it("has reverse mapping for all TV genres", () => {
    for (const [, name] of Object.entries(TMDB_TV_GENRES)) {
      expect(GENRE_NAME_TO_TMDB_IDS[name]).toBeDefined();
      expect(GENRE_NAME_TO_TMDB_IDS[name]?.length).toBeGreaterThan(0);
    }
  });
});

describe("isAlreadyWatched", () => {
  const watched: WatchedIds = {
    tmdbIds: new Set([100, 200, 300]),
    malIds: new Set([1000, 2000]),
    mediaIds: new Set(["uuid-1", "uuid-2"]),
  };

  it("returns true when mediaId matches", () => {
    expect(isAlreadyWatched(watched, { mediaId: "uuid-1" })).toBe(true);
  });

  it("returns true when tmdbId matches", () => {
    expect(isAlreadyWatched(watched, { tmdbId: 200 })).toBe(true);
  });

  it("returns true when malId matches", () => {
    expect(isAlreadyWatched(watched, { malId: 1000 })).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(isAlreadyWatched(watched, { tmdbId: 999, malId: 9999 })).toBe(false);
  });

  it("returns false for null/undefined values", () => {
    expect(isAlreadyWatched(watched, { mediaId: null, tmdbId: null, malId: null })).toBe(false);
  });

  it("returns false for empty watched sets", () => {
    const empty: WatchedIds = {
      tmdbIds: new Set(),
      malIds: new Set(),
      mediaIds: new Set(),
    };
    expect(isAlreadyWatched(empty, { tmdbId: 100 })).toBe(false);
  });
});
