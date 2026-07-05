import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test" } }));
vi.mock("@/lib/api/jikan", () => ({
  getAnimeDetails: vi.fn(),
}));
vi.mock("@/lib/recommendations/rec-source-cache", () => ({
  getCachedRecommendations: vi.fn(() => Promise.resolve(null)),
  cacheRecommendations: vi.fn(() => Promise.resolve()),
}));

import { getAnimeDetails } from "@/lib/api/jikan";
import { hydrateAnimeItems } from "@/lib/recommendations/anime-hydrate";
import {
  cacheRecommendations,
  getCachedRecommendations,
} from "@/lib/recommendations/rec-source-cache";
import type { RecommendationItem } from "@/lib/recommendations/types";

function animeItem(malId: number, overrides: Partial<RecommendationItem> = {}): RecommendationItem {
  return {
    mediaId: null,
    tmdbId: null,
    malId,
    title: `Anime ${String(malId)}`,
    posterUrl: null,
    mediaType: "anime",
    overview: null,
    releaseYear: null,
    voteAverage: null,
    genres: [],
    score: 0.5,
    recType: "jikan",
    reasons: [],
    ...overrides,
  };
}

const details = (malId: number) => ({
  data: {
    mal_id: malId,
    genres: [{ mal_id: 1, name: "Action" }],
    themes: [{ mal_id: 46, name: "Award Winning" }],
    demographics: [{ mal_id: 27, name: "Shounen" }],
    year: 2019,
    score: 8.6,
  },
});

describe("hydrateAnimeItems", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCachedRecommendations).mockResolvedValue(null);
    vi.mocked(cacheRecommendations).mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Un-spy Date.now (the time-budget test) so other tests keep a real clock.
    vi.restoreAllMocks();
  });

  it("fills genres, year, and vote average from fetched details and caches them", async () => {
    vi.mocked(getAnimeDetails).mockResolvedValue(
      details(100) as Awaited<ReturnType<typeof getAnimeDetails>>,
    );

    const [hydrated] = await hydrateAnimeItems([animeItem(100)]);

    expect(hydrated?.genres).toEqual(["Action", "Award Winning", "Shounen"]);
    expect(hydrated?.releaseYear).toBe(2019);
    expect(hydrated?.voteAverage).toBe(8.6);
    expect(cacheRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "anime-full", malId: 100 }),
    );
  });

  it("uses cached details without fetching", async () => {
    vi.mocked(getCachedRecommendations).mockResolvedValue([details(100).data]);

    const [hydrated] = await hydrateAnimeItems([animeItem(100)]);

    expect(hydrated?.genres).toEqual(["Action", "Award Winning", "Shounen"]);
    expect(getAnimeDetails).not.toHaveBeenCalled();
  });

  it("leaves non-anime items and items that already have genres untouched", async () => {
    const movie = animeItem(0, { mediaType: "movie", malId: null, tmdbId: 5 });
    const genred = animeItem(200, { genres: ["Drama"] });

    const result = await hydrateAnimeItems([movie, genred]);

    expect(result).toEqual([movie, genred]);
    expect(getAnimeDetails).not.toHaveBeenCalled();
  });

  it("caps live fetches per call, hydrating the rest from cache only", async () => {
    vi.mocked(getAnimeDetails).mockResolvedValue(
      details(1) as Awaited<ReturnType<typeof getAnimeDetails>>,
    );
    const items = Array.from({ length: 5 }, (_, index) => animeItem(index + 1));

    await hydrateAnimeItems(items, 2);

    expect(getAnimeDetails).toHaveBeenCalledTimes(2);
  });

  it("returns the item unchanged when the details fetch fails", async () => {
    vi.mocked(getAnimeDetails).mockRejectedValue(new Error("jikan down"));

    const item = animeItem(300);
    const [hydrated] = await hydrateAnimeItems([item]);

    expect(hydrated).toEqual(item);
  });

  it("stops live fetching once the time budget is spent, even when fetches succeed", async () => {
    // A slow-but-healthy Jikan (~4s per call) must not stack ten calls onto a
    // serverless request. Simulate a 6s fetch via a mocked clock.
    let clock = 0;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    vi.mocked(getAnimeDetails).mockImplementation((malId: number) => {
      clock += 6000;
      return Promise.resolve(details(malId) as Awaited<ReturnType<typeof getAnimeDetails>>);
    });
    const items = Array.from({ length: 4 }, (_, index) => animeItem(index + 1));

    const hydrated = await hydrateAnimeItems(items);

    expect(getAnimeDetails).toHaveBeenCalledTimes(1);
    expect(hydrated[0]?.genres).toEqual(["Action", "Award Winning", "Shounen"]);
    expect(hydrated[1]?.genres).toEqual([]);
  });

  it("stops live fetching after the first failure so a dead Jikan can't stall the request", async () => {
    // Each failed fetch burns its full 4s timeout; ten in a row approaches the
    // serverless function limit. One failure means Jikan is unhealthy — bail.
    vi.mocked(getAnimeDetails).mockRejectedValue(new Error("jikan down"));
    const items = Array.from({ length: 4 }, (_, index) => animeItem(index + 1));

    await hydrateAnimeItems(items);

    expect(getAnimeDetails).toHaveBeenCalledTimes(1);
  });
});
