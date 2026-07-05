import { beforeEach, describe, expect, it, vi } from "vitest";

// Chainable stub: every builder method returns the query object; execute resolves empty.
// Tests can override `db.execute` to feed getUserTopGenre rating rows.
vi.mock("@/lib/db", () => {
  const query = {
    selectFrom: () => query,
    innerJoin: () => query,
    select: () => query,
    where: () => query,
    execute: vi.fn(() => Promise.resolve([])),
  };
  return { db: query };
});
vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test" } }));
vi.mock("@/lib/api/tmdb", () => ({
  discoverMovies: vi.fn(() => Promise.resolve({ results: [] })),
  discoverTv: vi.fn(() => Promise.resolve({ results: [] })),
  tmdbImageUrl: vi.fn(() => null),
}));
vi.mock("@/lib/api/jikan", () => ({
  discoverAnime: vi.fn(() => Promise.resolve({ data: [] })),
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
  mergeWatchedIds: vi.fn(() => ({
    tmdbIds: new Set(),
    malIds: new Set(),
    mediaIds: new Set(),
  })),
}));

import { discoverAnime } from "@/lib/api/jikan";
import { discoverMovies, discoverTv } from "@/lib/api/tmdb";
import { computeFilteredRecommendations } from "@/lib/recommendations/filtered";

function movieResult(id: number) {
  return {
    id,
    title: `Movie ${String(id)}`,
    poster_path: null,
    overview: "",
    release_date: "2015-06-01",
    vote_average: 7.4,
    genre_ids: [27],
  };
}

describe("computeFilteredRecommendations vertical skipping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips movie and TV discover entirely for a MAL-only genre", async () => {
    await computeFilteredRecommendations("user-1", { genre: ["Award Winning"] });

    expect(discoverMovies).not.toHaveBeenCalled();
    expect(discoverTv).not.toHaveBeenCalled();
    expect(discoverAnime).toHaveBeenCalled();
    const params = vi.mocked(discoverAnime).mock.calls[0]?.[0];
    expect(params?.genres).toBe("46");
  });

  it("skips TV discover for a movie-only genre with no TV alias", async () => {
    await computeFilteredRecommendations("user-1", { genre: ["Horror"] });

    // Horror exists for movies (27) and MAL (14) but has no TMDB TV genre.
    expect(discoverMovies).toHaveBeenCalled();
    expect(discoverTv).not.toHaveBeenCalled();
    expect(discoverAnime).toHaveBeenCalled();
  });

  it("still queries every vertical when no genre filter is set and no top genre exists", async () => {
    await computeFilteredRecommendations("user-1", {
      genre: [],
      mediaType: ["movie", "tv", "anime"],
      decade: ["2020"],
    });

    expect(discoverMovies).toHaveBeenCalled();
    expect(discoverTv).toHaveBeenCalled();
    expect(discoverAnime).toHaveBeenCalled();
  });

  it("keeps querying all verticals when the genre seed is the top-genre fallback", async () => {
    // No explicit genre filter; the user's top genre (from ratings) is MAL-only.
    // Movies/TV must NOT be skipped — the seed is a quality hint, not a filter.
    const { db } = await import("@/lib/db");
    (db as unknown as { execute: ReturnType<typeof vi.fn> }).execute.mockResolvedValueOnce([
      { genres: ["Award Winning"], score: "9" },
    ]);

    await computeFilteredRecommendations("user-1", { decade: ["2010"] });

    expect(discoverMovies).toHaveBeenCalled();
    expect(discoverTv).toHaveBeenCalled();
    expect(discoverAnime).toHaveBeenCalled();
  });

  it("queries a vertical with only its mapped genres when the selection is mixed", async () => {
    await computeFilteredRecommendations("user-1", { genre: ["Award Winning", "Action"] });

    const movieParams = vi.mocked(discoverMovies).mock.calls[0]?.[0];
    expect(movieParams?.with_genres).toBe("28");
  });

  it("applies a rating floor so deep exploration can't surface junk", async () => {
    await computeFilteredRecommendations("user-1", { genre: ["Horror"], mediaType: ["movie"] });

    const params = vi.mocked(discoverMovies).mock.calls[0]?.[0];
    expect(params?.["vote_average.gte"]).toBe("6.5");
    expect(params?.["vote_count.gte"]).toBe("100");
  });

  it("sends the second movie fetch deep into the genre's real catalog", async () => {
    // Anchor fetch lands in the top-5-page window; the explorer fetch may go
    // as deep as min(total_pages, 25). Constant randomness pins both picks.
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    vi.mocked(discoverMovies).mockResolvedValue({
      page: 1,
      total_pages: 500,
      total_results: 10_000,
      results: [movieResult(1)],
    } as Awaited<ReturnType<typeof discoverMovies>>);

    await computeFilteredRecommendations("user-1", { genre: ["Horror"], mediaType: ["movie"] });

    const pages = vi.mocked(discoverMovies).mock.calls.map((call) => call[0].page);
    expect(pages).toEqual(["5", "25"]);
    vi.restoreAllMocks();
  });

  it("keeps the explorer fetch inside small catalogs", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    vi.mocked(discoverMovies).mockResolvedValue({
      page: 1,
      total_pages: 3,
      total_results: 45,
      results: [movieResult(2)],
    } as Awaited<ReturnType<typeof discoverMovies>>);

    await computeFilteredRecommendations("user-1", { genre: ["Horror"], mediaType: ["movie"] });

    const pages = vi.mocked(discoverMovies).mock.calls.map((call) => call[0].page);
    // Anchor at page 5 may overshoot a 3-page catalog (empty page, handled);
    // the explorer must stay within the real 3 pages.
    expect(Number(pages[1])).toBeLessThanOrEqual(3);
    vi.restoreAllMocks();
  });

  it("labels each vertical's results with only the genres that applied to it", async () => {
    vi.mocked(discoverMovies).mockResolvedValue({
      results: [
        {
          id: 1,
          title: "Heat",
          poster_path: null,
          overview: "",
          release_date: "1995-12-15",
          vote_average: 8.3,
          genre_ids: [28],
        },
      ],
    } as Awaited<ReturnType<typeof discoverMovies>>);

    const items = await computeFilteredRecommendations("user-1", {
      genre: ["Award Winning", "Action"],
      mediaType: ["movie"],
    });

    // "Award Winning" never applied to the movie query, so the reason must not name it.
    expect(items[0]?.reasons[0]?.detail).toBe("Top Action movies");
  });
});
