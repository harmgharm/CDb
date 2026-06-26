import { describe, expect, it } from "vitest";

import { collectSearchResults } from "@/lib/media/search";
import type { MediaSearchResult } from "@/types/media";

function makeResult(overrides: Partial<MediaSearchResult>): MediaSearchResult {
  return {
    externalId: 1,
    title: "A Title",
    type: "movie",
    posterUrl: null,
    releaseYear: null,
    overview: null,
    source: "tmdb",
    ...overrides,
  };
}

const movie = makeResult({ externalId: 10, title: "Movie", type: "movie", source: "tmdb" });
const show = makeResult({ externalId: 20, title: "Show", type: "tv", source: "tmdb" });
const anime = makeResult({ externalId: 30, title: "Anime", type: "anime", source: "jikan" });

describe("collectSearchResults", () => {
  it("returns all sources' results when every source succeeds", async () => {
    const out = await collectSearchResults([
      { key: "movie", run: () => Promise.resolve([movie]) },
      { key: "tv", run: () => Promise.resolve([show]) },
      { key: "anime", run: () => Promise.resolve([anime]) },
    ]);

    expect(out.results).toEqual([movie, show, anime]);
    expect(out.failures).toEqual([]);
  });

  it("isolates a failing source: keeps the others, reports the failure", async () => {
    // The real-world bug: Jikan 504s while TMDB succeeds. The whole search used
    // to 500; now movie/tv results survive and only `anime` is flagged.
    const out = await collectSearchResults([
      { key: "movie", run: () => Promise.resolve([movie]) },
      { key: "tv", run: () => Promise.resolve([show]) },
      {
        key: "anime",
        run: () => Promise.reject(new Error("Jikan API error: 504 Gateway Time-out")),
      },
    ]);

    expect(out.results).toEqual([movie, show]);
    expect(out.failures.map((f) => f.key)).toEqual(["anime"]);
  });

  it("captures the error each failed source threw", async () => {
    // The route logs these so an operator can tell a 504 from a real bug.
    const jikanError = new Error("Jikan API error: 504 Gateway Time-out");
    const out = await collectSearchResults([
      { key: "movie", run: () => Promise.resolve([movie]) },
      { key: "anime", run: () => Promise.reject(jikanError) },
    ]);

    expect(out.failures).toEqual([{ key: "anime", error: jikanError }]);
  });

  it("reports every failed source when several are down", async () => {
    const out = await collectSearchResults([
      { key: "movie", run: () => Promise.reject(new Error("TMDB down")) },
      { key: "anime", run: () => Promise.reject(new Error("Jikan down")) },
    ]);

    expect(out.results).toEqual([]);
    expect(out.failures.map((f) => f.key)).toEqual(["movie", "anime"]);
  });

  it("preserves source order regardless of which resolves first", async () => {
    // anime resolves immediately, movie after a tick — output must still be
    // movie-then-anime (declaration order), not completion order.
    const out = await collectSearchResults([
      {
        key: "movie",
        run: () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolve([movie]);
            }, 5),
          ),
      },
      { key: "anime", run: () => Promise.resolve([anime]) },
    ]);

    expect(out.results).toEqual([movie, anime]);
    expect(out.failures).toEqual([]);
  });
});
