import { describe, expect, it } from "vitest";

import { isTotalSearchOutage } from "@/lib/media/classify-search-outcome";

describe("isTotalSearchOutage", () => {
  it("is false when results came back, even if a source failed", () => {
    // Partial failure: Jikan down but TMDB returned matches. Soft notice only.
    expect(
      isTotalSearchOutage({
        resultCount: 40,
        failedSources: ["anime"],
        attemptedSources: ["movie", "tv", "anime"],
      }),
    ).toBe(false);
  });

  it("is false when a query simply has no matches and nothing failed", () => {
    // Genuine "no results" — every source answered, none failed.
    expect(
      isTotalSearchOutage({
        resultCount: 0,
        failedSources: [],
        attemptedSources: ["movie", "tv", "anime"],
      }),
    ).toBe(false);
  });

  it("is FALSE for a partial failure that happens to have no matches (the bug)", () => {
    // The reproduced bug: "All types", Jikan 504s, the query has no TMDB matches.
    // TMDB still answered (it just had nothing) — only anime is down. This must
    // NOT be treated as a total outage / red box.
    expect(
      isTotalSearchOutage({
        resultCount: 0,
        failedSources: ["anime"],
        attemptedSources: ["movie", "tv", "anime"],
      }),
    ).toBe(false);
  });

  it("is true when EVERY attempted source failed and there are no results", () => {
    // True total outage: all three external APIs down.
    expect(
      isTotalSearchOutage({
        resultCount: 0,
        failedSources: ["movie", "tv", "anime"],
        attemptedSources: ["movie", "tv", "anime"],
      }),
    ).toBe(true);
  });

  it("is true when the only attempted source failed (single-type filter)", () => {
    // Filtered to Anime, Jikan down — every attempted source (just anime) failed.
    expect(
      isTotalSearchOutage({
        resultCount: 0,
        failedSources: ["anime"],
        attemptedSources: ["anime"],
      }),
    ).toBe(true);
  });

  it("is false when no sources were attempted (defensive)", () => {
    expect(isTotalSearchOutage({ resultCount: 0, failedSources: [], attemptedSources: [] })).toBe(
      false,
    );
  });
});
