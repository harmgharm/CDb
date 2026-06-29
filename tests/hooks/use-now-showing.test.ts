import { describe, expect, it } from "vitest";

import { selectNowShowing, type SessionRow } from "@/hooks/use-now-showing";

function makeSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "s1",
    date_watched: "2026-06-14",
    media_id: "m1",
    media_title: "Dune",
    media_type: "movie",
    media_poster_url: null,
    attendee_count: 3,
    rated_count: 3,
    ...overrides,
  };
}

describe("selectNowShowing", () => {
  it("returns no items when there are no sessions", () => {
    expect(selectNowShowing([])).toEqual({ items: [] });
  });

  it("keeps at most the two most recent sessions", () => {
    const sessions = [
      makeSession({ id: "s1" }),
      makeSession({ id: "s2" }),
      makeSession({ id: "s3" }),
    ];

    const result = selectNowShowing(sessions);

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.sessionId)).toEqual(["s1", "s2"]);
  });

  it("marks a session rated when every attendee has rated", () => {
    const result = selectNowShowing([makeSession({ attendee_count: 5, rated_count: 5 })]);

    expect(result.items[0]?.status).toBe("rated");
  });

  it("marks a session in-progress when some attendees still owe a rating", () => {
    const result = selectNowShowing([makeSession({ attendee_count: 5, rated_count: 3 })]);

    expect(result.items[0]?.status).toBe("in-progress");
  });

  it("exposes the group rating progress counts", () => {
    const result = selectNowShowing([makeSession({ attendee_count: 5, rated_count: 3 })]);

    expect(result.items[0]?.ratedCount).toBe(3);
    expect(result.items[0]?.attendeeCount).toBe(5);
  });

  it("treats a session with no recorded attendees as rated (nothing pending)", () => {
    const result = selectNowShowing([makeSession({ attendee_count: 0, rated_count: 0 })]);

    expect(result.items[0]?.status).toBe("rated");
  });

  it("classifies a mixed pair independently", () => {
    const sessions = [
      makeSession({ id: "s1", attendee_count: 4, rated_count: 4 }),
      makeSession({ id: "s2", attendee_count: 4, rated_count: 1 }),
    ];
    const result = selectNowShowing(sessions);

    expect(result.items.map((item) => item.status)).toEqual(["rated", "in-progress"]);
  });

  it("links each item to its media detail page", () => {
    const result = selectNowShowing([makeSession({ media_id: "abc" })]);

    expect(result.items[0]?.href).toBe("/database/abc");
  });

  it("carries through the title, poster, type, and watch date", () => {
    const session = makeSession({
      media_title: "Akira",
      media_type: "anime",
      media_poster_url: "https://example.test/akira.jpg",
      date_watched: "2026-06-10",
    });

    const result = selectNowShowing([session]);

    expect(result.items[0]).toMatchObject({
      title: "Akira",
      mediaType: "anime",
      posterUrl: "https://example.test/akira.jpg",
      dateWatched: "2026-06-10",
    });
  });
});
