import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test" } }));
vi.mock("@/lib/api/tmdb", () => ({
  getMovieRecommendations: vi.fn(),
  getMovieSimilar: vi.fn(),
  getTvRecommendations: vi.fn(),
  getTvSimilar: vi.fn(),
  tmdbImageUrl: vi.fn(() => null),
}));
vi.mock("@/lib/api/jikan", () => ({
  getAnimeRecommendations: vi.fn(),
}));
vi.mock("@/lib/recommendations/rec-source-cache", () => ({
  getCachedRecommendations: vi.fn(() => Promise.resolve(null)),
  cacheRecommendations: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/recommendations/dismissed", () => ({
  getUserDismissedIds: vi.fn(() =>
    Promise.resolve({ tmdbIds: new Set(), malIds: new Set(), mediaIds: new Set() }),
  ),
}));
vi.mock("@/lib/recommendations/watched", () => ({
  getUserWatchedIds: vi.fn(() =>
    Promise.resolve({ tmdbIds: new Set(), malIds: new Set(), mediaIds: new Set() }),
  ),
  getUserWatchedAnimeTitles: vi.fn(() => Promise.resolve(new Set())),
  isAlreadyWatched: vi.fn(() => false),
  isWatchedAnimeTitle: vi.fn(() => false),
  mergeWatchedIds: vi.fn(() => ({ tmdbIds: new Set(), malIds: new Set(), mediaIds: new Set() })),
}));
vi.mock("@/lib/recommendations/anime-hydrate", () => ({
  hydrateAnimeItems: vi.fn((items: unknown[]) => Promise.resolve(items)),
}));

import { hydrateAnimeItems } from "@/lib/recommendations/anime-hydrate";
import { computeSimilarRecommendations } from "@/lib/recommendations/similar";

describe("computeSimilarRecommendations hydration", () => {
  it("hydrates anime items cache-only (zero live fetches) to keep the click fast", async () => {
    await computeSimilarRecommendations("user-1", [], 20);

    expect(hydrateAnimeItems).toHaveBeenCalledWith(expect.any(Array), 0);
  });
});
