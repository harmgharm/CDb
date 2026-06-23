import { describe, expect, it } from "vitest";

import type { QueueProposalView } from "@/hooks/use-queue";
import { resolveUpNext, selectUpNext, type UpNextLoading } from "@/hooks/use-up-next";
import type { WatchlistItem } from "@/types/watchlist-responses";

/** All-settled loading flags by default; override individual sources per test. */
function loadingFlags(overrides: Partial<UpNextLoading> = {}): UpNextLoading {
  return { queueLoading: false, watchingLoading: false, planningLoading: false, ...overrides };
}

function makeWatchlistItem(overrides: Partial<WatchlistItem> = {}): WatchlistItem {
  return {
    id: "w1",
    user_id: "u1",
    status: "watching",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    title: "Dune",
    poster_url: null,
    media_type: "movie",
    media_id: "m-dune",
    tmdb_id: null,
    mal_id: null,
    ...overrides,
  };
}

function makeScheduled(overrides: Partial<QueueProposalView> = {}): QueueProposalView {
  return {
    id: "sched",
    status: "scheduled",
    scheduledDate: null,
    proposedAt: "2026-01-01T00:00:00Z",
    voteCount: 0,
    hasVoted: false,
    wonVotes: null,
    runnerUpVotes: null,
    media: { id: "m-sinners", title: "Sinners", type: "movie", posterUrl: null },
    proposer: { id: "u2", username: "harm", displayName: "Harm", avatarUrl: null },
    ...overrides,
  };
}

describe("selectUpNext", () => {
  it("returns nothing when there is no scheduled pick and the watchlist is empty", () => {
    expect(selectUpNext(null, undefined, undefined)).toEqual({ data: null, source: null });
  });

  describe("priority order", () => {
    it("prefers the scheduled queue pick over both watchlist entries", () => {
      const result = selectUpNext(
        makeScheduled(),
        makeWatchlistItem({ title: "Watching" }),
        makeWatchlistItem({ title: "Planning", status: "planning" }),
      );

      expect(result.source).toBe("queue");
      expect(result.data?.title).toBe("Sinners");
    });

    it("falls through to the top watching entry when there is no scheduled pick", () => {
      const result = selectUpNext(
        null,
        makeWatchlistItem({ title: "Watching" }),
        makeWatchlistItem({ title: "Planning", status: "planning" }),
      );

      expect(result.source).toBe("in-progress");
      expect(result.data?.title).toBe("Watching");
    });

    it("falls through to the top planning entry when nothing is scheduled or watching", () => {
      const result = selectUpNext(
        null,
        undefined,
        makeWatchlistItem({ title: "Planning", status: "planning" }),
      );

      expect(result.source).toBe("watchlist");
      expect(result.data?.title).toBe("Planning");
    });
  });

  describe("queue source", () => {
    it("links to the scheduled pick's media detail page", () => {
      const result = selectUpNext(
        makeScheduled({ media: { id: "abc", title: "X", type: "tv", posterUrl: null } }),
        undefined,
        undefined,
      );

      expect(result.data?.href).toBe("/database/abc");
    });

    it("carries through the title, poster, and media type", () => {
      const result = selectUpNext(
        makeScheduled({
          media: {
            id: "m1",
            title: "Akira",
            type: "anime",
            posterUrl: "https://example.test/a.jpg",
          },
        }),
        undefined,
        undefined,
      );

      expect(result.data).toMatchObject({
        title: "Akira",
        mediaType: "anime",
        posterUrl: "https://example.test/a.jpg",
        mediaId: "m1",
      });
    });

    it("builds a dated eyebrow that reuses the dashboard date format", () => {
      // 2026-07-01 is a Wednesday — same formatting as the dashboard scheduled card.
      const result = selectUpNext(
        makeScheduled({ scheduledDate: "2026-07-01" }),
        undefined,
        undefined,
      );

      expect(result.data?.eyebrow).toBe("UP NEXT · Wed · Jul 1");
    });

    it("reuses the matched NO DATE YET sentinel in the eyebrow for a dateless pick", () => {
      const result = selectUpNext(makeScheduled({ scheduledDate: null }), undefined, undefined);

      expect(result.data?.eyebrow).toBe("UP NEXT · NO DATE YET");
    });

    it("exposes the proposer's display name for the 'Proposed by' line", () => {
      const result = selectUpNext(
        makeScheduled({
          proposer: { id: "u2", username: "harmgharm", displayName: "Harm", avatarUrl: null },
        }),
        undefined,
        undefined,
      );

      expect(result.data?.proposedBy).toBe("Harm");
    });

    it("falls back to the username when the proposer has no display name", () => {
      const result = selectUpNext(
        makeScheduled({
          proposer: { id: "u2", username: "harmgharm", displayName: null, avatarUrl: null },
        }),
        undefined,
        undefined,
      );

      expect(result.data?.proposedBy).toBe("harmgharm");
    });

    it("reads 'someone' when the proposer was deleted", () => {
      const result = selectUpNext(makeScheduled({ proposer: null }), undefined, undefined);

      expect(result.data?.proposedBy).toBe("someone");
    });
  });

  describe("watchlist sources carry no queue-only fields", () => {
    it("leaves eyebrow and proposedBy undefined for the watching source", () => {
      const result = selectUpNext(null, makeWatchlistItem(), undefined);

      expect(result.data?.eyebrow).toBeUndefined();
      expect(result.data?.proposedBy).toBeUndefined();
    });

    it("routes an unimported watchlist entry to the watchlist page", () => {
      const result = selectUpNext(
        null,
        makeWatchlistItem({ media_id: null, tmdb_id: 123 }),
        undefined,
      );

      expect(result.data?.href).toBe("/watchlist");
    });
  });
});

describe("resolveUpNext", () => {
  const queueItem = makeScheduled();
  const watchingItem = makeWatchlistItem({ title: "Watching" });

  it("waits (loading) when the queue is still loading even though a watchlist item resolved first", () => {
    // The race: /api/watchlist resolves before /api/queue. selectUpNext sees a
    // null scheduled pick (queue not in yet) and would pick the watchlist item —
    // but the queue could still resolve with a higher-priority scheduled pick.
    // Committing now would flash the watchlist item, then pop to the queue.
    const selection = selectUpNext(null, watchingItem, undefined);

    const resolved = resolveUpNext(selection, loadingFlags({ queueLoading: true }));

    expect(resolved.isLoading).toBe(true);
    expect(resolved.source).toBeNull();
    expect(resolved.data).toBeNull();
  });

  it("returns the queue pick immediately even while the watchlist is still loading", () => {
    const selection = selectUpNext(queueItem, undefined, undefined);

    const resolved = resolveUpNext(selection, loadingFlags({ watchingLoading: true }));

    expect(resolved.source).toBe("queue");
    expect(resolved.isLoading).toBe(false);
  });

  it("returns the watchlist source once the queue has settled with no scheduled pick", () => {
    const selection = selectUpNext(null, watchingItem, undefined);

    const resolved = resolveUpNext(selection, loadingFlags());

    expect(resolved.source).toBe("in-progress");
    expect(resolved.isLoading).toBe(false);
  });

  it("waits when the queue settled empty but a watchlist request is still loading", () => {
    const selection = selectUpNext(null, undefined, undefined);

    const resolved = resolveUpNext(selection, loadingFlags({ planningLoading: true }));

    expect(resolved.source).toBeNull();
    expect(resolved.isLoading).toBe(true);
  });

  it("reports nothing (not loading) once everything has settled empty", () => {
    const selection = selectUpNext(null, undefined, undefined);

    const resolved = resolveUpNext(selection, loadingFlags());

    expect(resolved).toEqual({ data: null, source: null, isLoading: false });
  });
});
