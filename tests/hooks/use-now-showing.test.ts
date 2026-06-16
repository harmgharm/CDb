import { describe, expect, it } from "vitest";

import { type RatingRow, selectNowShowing, type SessionRow } from "@/hooks/use-now-showing";

function makeSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "s1",
    date_watched: "2026-06-14",
    media_id: "m1",
    media_title: "Dune",
    media_type: "movie",
    media_poster_url: null,
    ...overrides,
  };
}

function makeRating(sessionId: string): RatingRow {
  return { id: `r-${sessionId}`, session_id: sessionId, score: 8 };
}

describe("selectNowShowing", () => {
  it("returns no items when there are no sessions", () => {
    expect(selectNowShowing([], [])).toEqual({ items: [] });
  });

  it("keeps at most the two most recent sessions", () => {
    const sessions = [
      makeSession({ id: "s1" }),
      makeSession({ id: "s2" }),
      makeSession({ id: "s3" }),
    ];

    const result = selectNowShowing(sessions, []);

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.sessionId)).toEqual(["s1", "s2"]);
  });

  it("marks a session rated when the user has a rating for it", () => {
    const result = selectNowShowing([makeSession({ id: "s1" })], [makeRating("s1")]);

    expect(result.items[0]?.status).toBe("rated");
  });

  it("marks a session in-progress when the user has not rated it", () => {
    const result = selectNowShowing([makeSession({ id: "s1" })], []);

    expect(result.items[0]?.status).toBe("in-progress");
  });

  it("classifies a mixed pair independently", () => {
    const sessions = [makeSession({ id: "s1" }), makeSession({ id: "s2" })];
    const result = selectNowShowing(sessions, [makeRating("s1")]);

    expect(result.items.map((item) => item.status)).toEqual(["rated", "in-progress"]);
  });

  it("ignores ratings for sessions that are not shown", () => {
    const sessions = [makeSession({ id: "s1" }), makeSession({ id: "s2" })];
    // A rating for s3 (not among the shown sessions) must not flip s1/s2.
    const result = selectNowShowing(sessions, [makeRating("s3")]);

    expect(result.items.map((item) => item.status)).toEqual(["in-progress", "in-progress"]);
  });

  it("links each item to its media detail page", () => {
    const result = selectNowShowing([makeSession({ id: "s1", media_id: "abc" })], []);

    expect(result.items[0]?.href).toBe("/database/abc");
  });

  it("carries through the title, poster, type, and watch date", () => {
    const session = makeSession({
      id: "s1",
      media_title: "Akira",
      media_type: "anime",
      media_poster_url: "https://example.test/akira.jpg",
      date_watched: "2026-06-10",
    });

    const result = selectNowShowing([session], []);

    expect(result.items[0]).toMatchObject({
      title: "Akira",
      mediaType: "anime",
      posterUrl: "https://example.test/akira.jpg",
      dateWatched: "2026-06-10",
    });
  });
});
