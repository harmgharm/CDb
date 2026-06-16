import { describe, expect, it, vi } from "vitest";

// featured.ts imports db at module level; mock it so we can test the pure formatter.
vi.mock("@/lib/db", () => ({ db: {} }));

import { formatFeaturedMedia } from "@/lib/stats/featured";

describe("formatFeaturedMedia", () => {
  it("maps a row to the featured media shape", () => {
    const [result] = formatFeaturedMedia([
      {
        id: "m1",
        title: "Atlas Drift",
        type: "movie",
        poster_url: "https://example.test/atlas.jpg",
        avg_score: "8.4",
        rating_count: "5",
        release_year: 2025,
        runtime_minutes: 132,
        episode_count: null,
      },
    ]);

    expect(result).toEqual({
      id: "m1",
      title: "Atlas Drift",
      type: "movie",
      posterUrl: "https://example.test/atlas.jpg",
      avgScore: 8.4,
      ratingCount: 5,
      releaseYear: 2025,
      runtimeMinutes: 132,
      episodeCount: null,
    });
  });

  it("rounds the average score to one decimal", () => {
    const [result] = formatFeaturedMedia([
      {
        id: "m2",
        title: "Kage no Hana",
        type: "anime",
        poster_url: null,
        avg_score: 7.8666_667,
        rating_count: 3,
        release_year: 2024,
        runtime_minutes: 24,
        episode_count: 12,
      },
    ]);

    expect(result?.avgScore).toBe(7.9);
    expect(result?.episodeCount).toBe(12);
  });

  it("coerces string and bigint aggregate types from Kysely", () => {
    const [result] = formatFeaturedMedia([
      {
        id: "m3",
        title: "Glass Tunnels",
        type: "tv",
        poster_url: null,
        avg_score: "9",
        rating_count: 8n,
        release_year: null,
        runtime_minutes: null,
        episode_count: null,
      },
    ]);

    expect(result?.avgScore).toBe(9);
    expect(result?.ratingCount).toBe(8);
    expect(result?.releaseYear).toBeNull();
  });

  it("returns an empty array for no rows", () => {
    expect(formatFeaturedMedia([])).toEqual([]);
  });
});
