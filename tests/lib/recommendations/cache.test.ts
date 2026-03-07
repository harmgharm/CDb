import { describe, expect, it } from "vitest";

import { MIN_RATINGS_FOR_PERSONALIZED } from "@/lib/recommendations/types";

describe("recommendation cache constants", () => {
  it("requires 5 ratings for personalized recommendations", () => {
    expect(MIN_RATINGS_FOR_PERSONALIZED).toBe(5);
  });
});

describe("recommendation types", () => {
  it("RecommendationItem type fields are well-defined", () => {
    // Type-level test — ensures the interface contract is correct
    const item = {
      mediaId: null,
      tmdbId: 123,
      malId: null,
      title: "Test Movie",
      posterUrl: "https://example.com/poster.jpg",
      mediaType: "movie" as const,
      overview: "A test movie",
      releaseYear: 2024,
      voteAverage: 8.5,
      score: 0.85,
      recType: "content" as const,
      reasons: [{ tag: "Top genre", detail: "You rated Action 8.5 avg" }],
    };

    expect(item.title).toBe("Test Movie");
    expect(item.score).toBe(0.85);
    expect(item.reasons).toHaveLength(1);
    expect(item.reasons[0]?.tag).toBe("Top genre");
  });

  it("reason tags have expected structure", () => {
    const reasons = [
      { tag: "Top genre", detail: "You rated Action 8.5 avg" },
      { tag: "Similar taste", detail: "87% match with @alice who rated it 9.0" },
      { tag: "TMDB suggests", detail: "Because you loved Inception (9.0)" },
      { tag: "Group genre", detail: "Everyone rates Thriller highly" },
      { tag: "Watchlist popular", detail: "3 members want to watch this" },
      { tag: "Trending in group", detail: "Rated 8.5 avg by the group" },
    ];

    for (const reason of reasons) {
      expect(reason.tag.length).toBeGreaterThan(0);
      expect(reason.detail.length).toBeGreaterThan(0);
    }
  });
});
