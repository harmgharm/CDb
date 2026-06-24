import { describe, expect, it } from "vitest";

import { flattenTimelinePages, timelinePageKey } from "@/hooks/use-sessions";
import type { TimelineEntry, TimelinePayload } from "@/types/timeline-responses";

function entry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    sessionId: "s1",
    mediaId: "m1",
    title: "Atlas Drift",
    type: "movie",
    posterUrl: null,
    dateWatched: "2026-06-07",
    week: 23,
    pickerName: "Sam",
    rating: { average: 7.9, count: 5 },
    attendees: [],
    attendeeCount: 5,
    take: null,
    ...overrides,
  };
}

function page(overrides: Partial<TimelinePayload> = {}): TimelinePayload {
  return {
    items: [entry()],
    page: 1,
    limit: 20,
    groupSize: 5,
    hasMore: false,
    ...overrides,
  };
}

describe("timelinePageKey", () => {
  it("builds the first-page key with the include flag", () => {
    const key = timelinePageKey(0, null, {});
    expect(key).toBe("/api/sessions?include=timeline&page=1&limit=20");
  });

  it("encodes the type and search filters", () => {
    const key = timelinePageKey(0, null, { type: "anime", search: "kage no" });
    expect(key).toContain("type=anime");
    expect(key).toContain("search=kage+no");
  });

  it("encodes the chronological order when set", () => {
    expect(timelinePageKey(0, null, { order: "asc" })).toContain("order=asc");
    expect(timelinePageKey(0, null, { order: "desc" })).toContain("order=desc");
  });

  it("omits the order param when unset", () => {
    expect(timelinePageKey(0, null, {})).not.toContain("order=");
  });

  it("increments the page number for later indexes", () => {
    const key = timelinePageKey(2, page({ hasMore: true }), {});
    expect(key).toContain("page=3");
  });

  it("stops paging (returns null) once the previous page has no more", () => {
    const key = timelinePageKey(1, page({ hasMore: false }), {});
    expect(key).toBeNull();
  });
});

describe("flattenTimelinePages", () => {
  it("concatenates entries across pages in order", () => {
    const pages = [
      page({ items: [entry({ sessionId: "a" }), entry({ sessionId: "b" })] }),
      page({ items: [entry({ sessionId: "c" })] }),
    ];
    expect(flattenTimelinePages(pages).map((e) => e.sessionId)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty list when there are no pages", () => {
    expect(flattenTimelinePages(undefined)).toEqual([]);
  });
});
