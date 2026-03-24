import { describe, expect, it, vi } from "vitest";

// Mock db before importing signals (signals.ts imports db at module level)
vi.mock("@/lib/db", () => ({ db: {} }));

import {
  computeDirectorSignal,
  computeEraSignal,
  computeExternalSignal,
  computeGenreSignal,
} from "@/lib/predictions/signals";
import type { ResolvedMedia, UserAffinityData } from "@/lib/predictions/types";

function makeMedia(overrides: Partial<ResolvedMedia> = {}): ResolvedMedia {
  return {
    mediaId: null,
    tmdbId: 123,
    malId: null,
    title: "Test Movie",
    posterUrl: null,
    mediaType: "movie",
    releaseYear: 2020,
    genres: ["Action", "Drama"],
    directors: ["Christopher Nolan"],
    overview: null,
    runtimeMinutes: 148,
    episodeCount: null,
    voteAverage: 7.8,
    trailerUrl: null,
    ...overrides,
  };
}

function makeAffinity(overrides: Partial<UserAffinityData> = {}): UserAffinityData {
  return {
    genreScores: new Map(),
    directorScores: new Map(),
    decadeScores: new Map(),
    formatScores: new Map(),
    runtimeBucketScores: new Map(),
    overallAvg: 7,
    ratingCount: 15,
    ...overrides,
  };
}

// ============================================
// Genre Signal
// ============================================

describe("computeGenreSignal", () => {
  it("returns null score when media has no genres", () => {
    const result = computeGenreSignal(makeAffinity(), makeMedia({ genres: [] }));
    expect(result.score).toBeNull();
    expect(result.detail).toContain("No genre data");
  });

  it("returns null score when user has no matching genre ratings", () => {
    const affinity = makeAffinity({
      genreScores: new Map([["Comedy", { avg: 8, count: 5 }]]),
    });
    const result = computeGenreSignal(affinity, makeMedia({ genres: ["Horror"] }));
    expect(result.score).toBeNull();
    expect(result.detail).toContain("haven't rated");
  });

  it("computes weighted average from matching genres", () => {
    const affinity = makeAffinity({
      genreScores: new Map([
        ["Action", { avg: 8, count: 10 }],
        ["Drama", { avg: 7, count: 5 }],
      ]),
    });
    const result = computeGenreSignal(affinity, makeMedia({ genres: ["Action", "Drama"] }));

    // Weighted: (8*10 + 7*5) / (10+5) = 115/15 = 7.666... → 7.7
    expect(result.score).toBeCloseTo(7.7, 1);
    expect(result.weight).toBe(0.25);
    expect(result.detail).toContain("Action");
  });

  it("uses only matching genres, ignoring unrated ones", () => {
    const affinity = makeAffinity({
      genreScores: new Map([["Action", { avg: 9, count: 3 }]]),
    });
    const result = computeGenreSignal(affinity, makeMedia({ genres: ["Action", "Sci-Fi"] }));

    expect(result.score).toBe(9);
  });

  it("weights genres by count (more ratings = more influence)", () => {
    const affinity = makeAffinity({
      genreScores: new Map([
        ["Action", { avg: 9, count: 20 }],
        ["Drama", { avg: 5, count: 1 }],
      ]),
    });
    const result = computeGenreSignal(affinity, makeMedia({ genres: ["Action", "Drama"] }));

    // Action dominates: (9*20 + 5*1) / 21 = 185/21 ≈ 8.8
    expect(result.score).toBeGreaterThan(8.5);
  });
});

// ============================================
// Director Signal
// ============================================

describe("computeDirectorSignal", () => {
  it("returns null score when media has no directors", () => {
    const result = computeDirectorSignal(makeAffinity(), makeMedia({ directors: [] }));
    expect(result.score).toBeNull();
    expect(result.detail).toContain("No director data");
  });

  it("returns null score when user hasn't rated the director", () => {
    const affinity = makeAffinity({
      directorScores: new Map([["Spielberg", { avg: 8, count: 3 }]]),
    });
    const result = computeDirectorSignal(affinity, makeMedia({ directors: ["Nolan"] }));
    expect(result.score).toBeNull();
    expect(result.detail).toContain("haven't rated");
  });

  it("returns score based on matching director", () => {
    const affinity = makeAffinity({
      directorScores: new Map([["Christopher Nolan", { avg: 8.5, count: 4 }]]),
    });
    const result = computeDirectorSignal(affinity, makeMedia({ directors: ["Christopher Nolan"] }));
    expect(result.score).toBe(8.5);
    expect(result.weight).toBe(0.15);
    expect(result.detail).toContain("Christopher Nolan");
    expect(result.detail).toContain("4 titles");
  });

  it("picks the director with the highest count when multiple match", () => {
    const affinity = makeAffinity({
      directorScores: new Map([
        ["Director A", { avg: 6, count: 2 }],
        ["Director B", { avg: 9, count: 5 }],
      ]),
    });
    const result = computeDirectorSignal(
      affinity,
      makeMedia({ directors: ["Director A", "Director B"] }),
    );
    // Director B has more count (5 > 2), so their avg is used
    expect(result.score).toBe(9);
  });

  it("uses singular 'title' for count of 1", () => {
    const affinity = makeAffinity({
      directorScores: new Map([["Solo Director", { avg: 7, count: 1 }]]),
    });
    const result = computeDirectorSignal(affinity, makeMedia({ directors: ["Solo Director"] }));
    expect(result.detail).toContain("1 title");
    expect(result.detail).not.toContain("1 titles");
  });
});

// ============================================
// External Signal
// ============================================

describe("computeExternalSignal", () => {
  it("returns null score when no vote average", () => {
    const result = computeExternalSignal(makeMedia({ voteAverage: null }));
    expect(result.score).toBeNull();
    expect(result.detail).toContain("No community rating");
  });

  it("returns null score when vote average is 0", () => {
    const result = computeExternalSignal(makeMedia({ voteAverage: 0 }));
    expect(result.score).toBeNull();
  });

  it("returns TMDB source for standard media", () => {
    const result = computeExternalSignal(makeMedia({ tmdbId: 123, malId: null, voteAverage: 7.5 }));
    expect(result.score).toBe(7.5);
    expect(result.weight).toBe(0.1);
    expect(result.detail).toContain("TMDB");
  });

  it("returns MAL source when malId present and no tmdbId", () => {
    const result = computeExternalSignal(makeMedia({ tmdbId: null, malId: 456, voteAverage: 8.2 }));
    expect(result.score).toBe(8.2);
    expect(result.detail).toContain("MAL");
  });

  it("prefers TMDB when both IDs present", () => {
    const result = computeExternalSignal(makeMedia({ tmdbId: 123, malId: 456, voteAverage: 7 }));
    expect(result.detail).toContain("TMDB");
  });

  it("rounds score to 1 decimal place", () => {
    const result = computeExternalSignal(makeMedia({ voteAverage: 7.85 }));
    expect(result.score).toBe(7.9);
  });
});

// ============================================
// Era/Format Signal
// ============================================

describe("computeEraSignal", () => {
  it("returns null score when no sub-signals available", () => {
    const result = computeEraSignal(makeAffinity(), makeMedia());
    expect(result.score).toBeNull();
    expect(result.detail).toContain("Not enough data");
  });

  it("computes decade sub-signal correctly", () => {
    const affinity = makeAffinity({
      decadeScores: new Map([[2020, { avg: 8, count: 5 }]]),
    });
    const result = computeEraSignal(affinity, makeMedia({ releaseYear: 2023 }));
    expect(result.score).toBe(8);
    expect(result.detail).toContain("2020s");
  });

  it("requires at least 2 ratings per sub-signal", () => {
    const affinity = makeAffinity({
      decadeScores: new Map([[2020, { avg: 8, count: 1 }]]),
    });
    const result = computeEraSignal(affinity, makeMedia({ releaseYear: 2023 }));
    // Only 1 rating in decade → sub-signal excluded
    expect(result.score).toBeNull();
  });

  it("computes runtime sub-signal for short movies", () => {
    const affinity = makeAffinity({
      runtimeBucketScores: new Map([["short", { avg: 7, count: 3 }]]),
    });
    const result = computeEraSignal(affinity, makeMedia({ runtimeMinutes: 90 }));
    expect(result.score).toBe(7);
    expect(result.detail).toContain("shorter");
  });

  it("computes runtime sub-signal for medium movies", () => {
    const affinity = makeAffinity({
      runtimeBucketScores: new Map([["medium", { avg: 7.5, count: 4 }]]),
    });
    const result = computeEraSignal(affinity, makeMedia({ runtimeMinutes: 120 }));
    expect(result.score).toBe(7.5);
    expect(result.detail).toContain("medium-length");
  });

  it("computes runtime sub-signal for long movies", () => {
    const affinity = makeAffinity({
      runtimeBucketScores: new Map([["long", { avg: 6.5, count: 2 }]]),
    });
    const result = computeEraSignal(affinity, makeMedia({ runtimeMinutes: 180 }));
    expect(result.score).toBe(6.5);
    expect(result.detail).toContain("longer");
  });

  it("computes format sub-signal correctly", () => {
    const affinity = makeAffinity({
      formatScores: new Map([["anime", { avg: 9, count: 10 }]]),
    });
    const result = computeEraSignal(affinity, makeMedia({ mediaType: "anime" }));
    expect(result.score).toBe(9);
    expect(result.detail).toContain("anime");
  });

  it("averages multiple sub-signals equally", () => {
    const affinity = makeAffinity({
      decadeScores: new Map([[2020, { avg: 8, count: 5 }]]),
      formatScores: new Map([["movie", { avg: 6, count: 3 }]]),
    });
    const result = computeEraSignal(affinity, makeMedia({ releaseYear: 2023, mediaType: "movie" }));
    // (8 + 6) / 2 = 7
    expect(result.score).toBe(7);
  });

  it("blends all three sub-signals when available", () => {
    const affinity = makeAffinity({
      decadeScores: new Map([[2020, { avg: 9, count: 5 }]]),
      runtimeBucketScores: new Map([["medium", { avg: 6, count: 3 }]]),
      formatScores: new Map([["movie", { avg: 7.5, count: 4 }]]),
    });
    const result = computeEraSignal(
      affinity,
      makeMedia({ releaseYear: 2023, runtimeMinutes: 120, mediaType: "movie" }),
    );
    // (9 + 6 + 7.5) / 3 = 7.5
    expect(result.score).toBe(7.5);
  });

  it("skips decade sub-signal when releaseYear is null", () => {
    const affinity = makeAffinity({
      decadeScores: new Map([[2020, { avg: 9, count: 5 }]]),
      formatScores: new Map([["movie", { avg: 6, count: 3 }]]),
    });
    const result = computeEraSignal(affinity, makeMedia({ releaseYear: null, mediaType: "movie" }));
    // Only format sub-signal: 6
    expect(result.score).toBe(6);
  });

  it("skips runtime sub-signal when runtimeMinutes is null", () => {
    const affinity = makeAffinity({
      runtimeBucketScores: new Map([["short", { avg: 9, count: 5 }]]),
      formatScores: new Map([["movie", { avg: 6, count: 3 }]]),
    });
    const result = computeEraSignal(
      affinity,
      makeMedia({ runtimeMinutes: null, mediaType: "movie" }),
    );
    // Only format sub-signal: 6
    expect(result.score).toBe(6);
  });
});
