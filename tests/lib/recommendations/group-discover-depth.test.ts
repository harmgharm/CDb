import { beforeEach, describe, expect, it, vi } from "vitest";

// db stub replays a queue of result sets, one per .execute() call, in the
// order computeGroupRecommendations issues them: active users, then one
// ratings query per user, then watchlist popularity.
const executeQueue: unknown[][] = [];
vi.mock("@/lib/db", () => {
  const query = {
    selectFrom: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    select: () => query,
    where: () => query,
    groupBy: () => query,
    having: () => query,
    orderBy: () => query,
    execute: vi.fn(() => Promise.resolve(executeQueue.shift() ?? [])),
    executeTakeFirst: vi.fn(() => Promise.resolve(undefined)),
    fn: { countAll: () => ({ as: () => "count" }) },
  };
  return { db: query };
});
vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test" } }));
// Non-empty pages: the loop correctly stops early on an empty page, so each
// mocked page must return a result for the depth assertion to be meaningful.
let fakeId = 0;
vi.mock("@/lib/api/tmdb", () => ({
  discoverMovies: vi.fn(() => {
    fakeId += 1;
    return Promise.resolve({
      results: [
        {
          id: fakeId,
          title: `Movie ${String(fakeId)}`,
          poster_path: null,
          overview: "",
          release_date: "2020-01-01",
          vote_average: 7.5,
          genre_ids: [28],
        },
      ],
    });
  }),
  discoverTv: vi.fn(() => {
    fakeId += 1;
    return Promise.resolve({
      results: [
        {
          id: fakeId,
          name: `Show ${String(fakeId)}`,
          poster_path: null,
          overview: "",
          first_air_date: "2020-01-01",
          vote_average: 7.5,
          genre_ids: [10_759],
        },
      ],
    });
  }),
  tmdbImageUrl: vi.fn(() => null),
}));
vi.mock("@/lib/recommendations/watched", () => ({
  getGroupWatchedIds: vi.fn(() =>
    Promise.resolve({ tmdbIds: new Set(), malIds: new Set(), mediaIds: new Set() }),
  ),
  getGroupWatchedAnimeTitles: vi.fn(() => Promise.resolve(new Set())),
  isAlreadyWatched: vi.fn(() => false),
  isWatchedAnimeTitle: vi.fn(() => false),
}));

import { discoverMovies, discoverTv } from "@/lib/api/tmdb";
import { computeGroupRecommendations } from "@/lib/recommendations/group";

describe("computeGroupRecommendations discover depth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeQueue.length = 0;
  });

  it("fetches two discover pages per vertical so sections can fill 36 items", async () => {
    executeQueue.push(
      // active users
      [
        { user_id: "user-a", rating_count: "10" },
        { user_id: "user-b", rating_count: "12" },
      ],
      // per-user ratings → both love Action, so it is the shared genre
      [{ genres: ["Action"], score: "8" }],
      [{ genres: ["Action"], score: "9" }],
      // watchlist popularity
      [],
    );

    await computeGroupRecommendations();

    expect(discoverMovies).toHaveBeenCalledTimes(2);
    expect(discoverTv).toHaveBeenCalledTimes(2);
  });
});
