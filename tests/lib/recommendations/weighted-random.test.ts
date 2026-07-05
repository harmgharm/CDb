import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test" } }));

import { pickGenreSeeds } from "@/lib/recommendations/content";
import { weightedSampleByScore, weightedShuffle } from "@/lib/recommendations/random";

describe("weightedShuffle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a permutation — same members, no duplicates", () => {
    const items = [1, 2, 3, 4, 5];
    const result = weightedShuffle(items, (n) => n);

    expect([...result].toSorted((a, b) => a - b)).toEqual(items);
  });

  it("orders purely by weight when randomness is held constant", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const items = [
      { id: "low", weight: 0.1 },
      { id: "high", weight: 0.9 },
      { id: "mid", weight: 0.5 },
    ];

    const result = weightedShuffle(items, (item) => item.weight);

    expect(result.map((item) => item.id)).toEqual(["high", "mid", "low"]);
  });

  it("strongly favors high weights across many runs", () => {
    const items = [
      { id: "best", weight: 0.95 },
      { id: "worst", weight: 0.05 },
    ];
    let bestFirst = 0;
    for (let run = 0; run < 500; run += 1) {
      if (weightedShuffle(items, (item) => item.weight)[0]?.id === "best") bestFirst += 1;
    }

    expect(bestFirst).toBeGreaterThan(350);
  });

  it("handles empty input", () => {
    expect(weightedShuffle([], () => 1)).toEqual([]);
  });
});

describe("weightedSampleByScore", () => {
  it("returns count items from the pool", () => {
    const pool = Array.from({ length: 80 }, (_, index) => ({ id: index, score: index / 80 }));

    const sample = weightedSampleByScore(pool, 36);

    expect(sample).toHaveLength(36);
    const ids = new Set(sample.map((item) => item.id));
    expect(ids.size).toBe(36);
  });

  it("returns the whole pool when it is smaller than count", () => {
    const pool = [{ score: 0.5 }, { score: 0.7 }];

    expect(weightedSampleByScore(pool, 36)).toHaveLength(2);
  });
});

const genre = (name: string, avgRating: number) => ({ genre: name, avgRating, count: 5 });

describe("pickGenreSeeds", () => {
  it("picks 4 seeds from the top 8 loved queryable genres, favoring higher ratings", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const scores = [
      genre("Action", 9.5),
      genre("Comedy", 9),
      genre("Drama", 8.5),
      genre("Horror", 8),
      genre("Romance", 7.5),
      genre("Mystery", 7.2),
      genre("Western", 7.1),
      genre("Fantasy", 6), // below the 7.0 bar
    ];

    const seeds = pickGenreSeeds(scores);

    expect(seeds.map((s) => s.genre)).toEqual(["Action", "Comedy", "Drama", "Horror"]);
    vi.restoreAllMocks();

    // With real randomness, seeds always come from the loved pool, never below the bar.
    for (let run = 0; run < 50; run += 1) {
      const picked = pickGenreSeeds(scores);
      expect(picked).toHaveLength(4);
      for (const s of picked) {
        expect(s.avgRating).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it("skips loved genres that map to no discover vertical, so no seed slot is wasted", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const scores = [
      genre("Vampire", 9.8), // niche tag — unqueryable in TMDB and MAL
      genre("Action", 9),
      genre("Comedy", 8.5),
      genre("Drama", 8),
      genre("Horror", 7.5),
    ];

    const seeds = pickGenreSeeds(scores);

    expect(seeds.map((s) => s.genre)).toEqual(["Action", "Comedy", "Drama", "Horror"]);
  });

  it("returns fewer seeds when fewer genres clear the bar", () => {
    const seeds = pickGenreSeeds([genre("Action", 8), genre("Comedy", 6)]);

    expect(seeds.map((s) => s.genre)).toEqual(["Action"]);
  });
});
