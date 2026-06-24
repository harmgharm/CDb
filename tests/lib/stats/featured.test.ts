import { describe, expect, it, vi } from "vitest";

// featured.ts imports db at module level; mock it so we can test the pure formatter.
vi.mock("@/lib/db", () => ({ db: {} }));

import {
  attachFeaturedLineage,
  formatFeaturedMedia,
  selectCanonicalProposal,
} from "@/lib/stats/featured";

describe("formatFeaturedMedia", () => {
  it("maps a row to the featured media shape", () => {
    const [result] = formatFeaturedMedia([
      {
        id: "m1",
        title: "Atlas Drift",
        type: "movie",
        poster_url: "https://example.test/atlas.jpg",
        avg_score: "8.4",
        rating_count: "5",
        release_year: 2025,
        runtime_minutes: 132,
        episode_count: null,
      },
    ]);

    expect(result).toEqual({
      id: "m1",
      title: "Atlas Drift",
      type: "movie",
      posterUrl: "https://example.test/atlas.jpg",
      avgScore: 8.4,
      ratingCount: 5,
      releaseYear: 2025,
      runtimeMinutes: 132,
      episodeCount: null,
      // Lineage defaults — attached separately via attachFeaturedLineage.
      picker: null,
      attendees: [],
    });
  });

  it("rounds the average score to one decimal", () => {
    const [result] = formatFeaturedMedia([
      {
        id: "m2",
        title: "Kage no Hana",
        type: "anime",
        poster_url: null,
        avg_score: 7.8666_667,
        rating_count: 3,
        release_year: 2024,
        runtime_minutes: 24,
        episode_count: 12,
      },
    ]);

    expect(result?.avgScore).toBe(7.9);
    expect(result?.episodeCount).toBe(12);
  });

  it("coerces string and bigint aggregate types from Kysely", () => {
    const [result] = formatFeaturedMedia([
      {
        id: "m3",
        title: "Glass Tunnels",
        type: "tv",
        poster_url: null,
        avg_score: "9",
        rating_count: 8n,
        release_year: null,
        runtime_minutes: null,
        episode_count: null,
      },
    ]);

    expect(result?.avgScore).toBe(9);
    expect(result?.ratingCount).toBe(8);
    expect(result?.releaseYear).toBeNull();
  });

  it("returns an empty array for no rows", () => {
    expect(formatFeaturedMedia([])).toEqual([]);
  });
});

describe("selectCanonicalProposal", () => {
  it("returns null when a media has no watched proposals", () => {
    expect(selectCanonicalProposal([])).toBeNull();
  });

  it("returns the single watched proposal when there is one", () => {
    const only = { sessionId: "s1", dateWatched: "2026-03-01", createdAt: "2026-03-01T12:00:00Z" };
    expect(selectCanonicalProposal([only])).toBe(only);
  });

  it("picks the watched proposal with the later watch date for a re-watch", () => {
    const older = {
      sessionId: "s-old",
      dateWatched: "2026-01-01",
      createdAt: "2026-01-01T00:00:00Z",
    };
    const newer = {
      sessionId: "s-new",
      dateWatched: "2026-05-01",
      createdAt: "2026-05-01T00:00:00Z",
    };
    // Input order must not matter — the later date_watched wins.
    expect(selectCanonicalProposal([older, newer])).toBe(newer);
    expect(selectCanonicalProposal([newer, older])).toBe(newer);
  });

  it("ranks a row with a date_watched ahead of one without (NULLS LAST), regardless of created_at", () => {
    // The two-key rule must NOT collapse date + timestamp into one comparison:
    // a real watch date outranks a null one even if the null row was logged later.
    const dated = {
      sessionId: "dated",
      dateWatched: "2026-02-01",
      createdAt: "2026-02-01T09:00:00Z",
    };
    const undatedButLaterLog = {
      sessionId: "undated",
      dateWatched: null,
      createdAt: "2026-06-01T09:00:00Z",
    };
    expect(selectCanonicalProposal([dated, undatedButLaterLog])?.sessionId).toBe("dated");
    expect(selectCanonicalProposal([undatedButLaterLog, dated])?.sessionId).toBe("dated");
  });

  it("breaks ties on the same date_watched by created_at (later log wins)", () => {
    const earlierLog = {
      sessionId: "early",
      dateWatched: "2026-03-10",
      createdAt: "2026-03-10T08:00:00Z",
    };
    const laterLog = {
      sessionId: "late",
      dateWatched: "2026-03-10",
      createdAt: "2026-03-10T20:00:00Z",
    };
    expect(selectCanonicalProposal([earlierLog, laterLog])?.sessionId).toBe("late");
    expect(selectCanonicalProposal([laterLog, earlierLog])?.sessionId).toBe("late");
  });

  it("falls back to created_at ordering when both rows lack a date_watched", () => {
    const a = { sessionId: "a", dateWatched: null, createdAt: "2026-02-09T00:00:00Z" };
    const b = { sessionId: "b", dateWatched: null, createdAt: "2026-02-10T00:00:00Z" };
    expect(selectCanonicalProposal([a, b])?.sessionId).toBe("b");
  });
});

describe("attachFeaturedLineage", () => {
  // A formatted FeaturedMedia, as formatFeaturedMedia produces it (lineage
  // defaults to null/empty until attachFeaturedLineage fills it in).
  const media = {
    id: "m1",
    title: "Atlas Drift",
    type: "movie" as const,
    posterUrl: null,
    avgScore: 8.4,
    ratingCount: 5,
    releaseYear: 2025,
    runtimeMinutes: 132,
    episodeCount: null,
    picker: null,
    attendees: [],
  };

  it("attaches picker and attendees keyed by media id", () => {
    const lineage = new Map([
      [
        "m1",
        {
          picker: { username: "alex", displayName: "Alex", avatarUrl: null },
          attendees: [
            { username: "alex", displayName: "Alex", avatarUrl: null },
            { username: "sam", displayName: null, avatarUrl: "a.jpg" },
          ],
        },
      ],
    ]);

    const [result] = attachFeaturedLineage([media], lineage);
    expect(result?.picker).toEqual({ username: "alex", displayName: "Alex", avatarUrl: null });
    expect(result?.attendees).toHaveLength(2);
  });

  it("leaves picker null and attendees empty when a media has no lineage", () => {
    const [result] = attachFeaturedLineage([media], new Map());
    expect(result?.picker).toBeNull();
    expect(result?.attendees).toEqual([]);
  });
});
