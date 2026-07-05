import { describe, expect, it } from "vitest";

import type { RecommendationItem } from "@/lib/recommendations/types";
import { sliceWithTypeDepth } from "@/lib/recommendations/types";

function item(mediaType: "movie" | "tv" | "anime", score: number): RecommendationItem {
  return {
    mediaId: null,
    tmdbId: score,
    malId: null,
    title: `${mediaType} ${String(score)}`,
    posterUrl: null,
    mediaType,
    overview: null,
    releaseYear: null,
    voteAverage: null,
    genres: [],
    score,
    recType: "content",
    reasons: [],
  };
}

describe("sliceWithTypeDepth", () => {
  it("keeps at least a full display section (36) of a single type", () => {
    // Sections display 36 items; an anime-heavy pool must be able to fill
    // that even for one media type, or expanded sections end on ragged rows.
    const pool = Array.from({ length: 50 }, (_, index) => item("anime", index + 1));

    const sliced = sliceWithTypeDepth(pool, 80);

    expect(sliced.length).toBeGreaterThanOrEqual(36);
  });

  it("still respects the overall limit", () => {
    const pool = [
      ...Array.from({ length: 50 }, (_, index) => item("anime", index + 1)),
      ...Array.from({ length: 50 }, (_, index) => item("movie", index + 100)),
    ];

    const sliced = sliceWithTypeDepth(pool, 40);

    expect(sliced).toHaveLength(40);
  });
});
