import { describe, expect, it } from "vitest";

import { isWatchlistEntryProposed, planWatchlistPropose } from "@/lib/watchlist/propose";
import type { WatchlistItem } from "@/types/watchlist-responses";

function makeEntry(overrides: Partial<WatchlistItem>): WatchlistItem {
  return {
    id: "w1",
    user_id: "u1",
    status: "planning",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    title: "A Title",
    poster_url: null,
    media_type: "movie",
    media_id: null,
    tmdb_id: null,
    mal_id: null,
    ...overrides,
  };
}

describe("planWatchlistPropose", () => {
  it("proposes an imported entry directly by its media id", () => {
    const plan = planWatchlistPropose(makeEntry({ media_id: "media-123" }));
    expect(plan).toEqual({ kind: "direct", mediaId: "media-123" });
  });

  it("imports-then-proposes a TMDB-only entry", () => {
    const plan = planWatchlistPropose(
      makeEntry({ media_id: null, tmdb_id: 278, media_type: "movie" }),
    );
    expect(plan).toEqual({ kind: "import", params: { type: "movie", tmdbId: 278 } });
  });

  it("imports-then-proposes a MAL-only entry", () => {
    const plan = planWatchlistPropose(
      makeEntry({ media_id: null, mal_id: 456, media_type: "anime" }),
    );
    expect(plan).toEqual({ kind: "import", params: { type: "anime", malId: 456 } });
  });

  it("prefers the media id when an entry somehow carries both", () => {
    // A backfilled entry should never still hold external ids, but if it does,
    // the real media row wins — no pointless import round-trip.
    const plan = planWatchlistPropose(makeEntry({ media_id: "media-9", tmdb_id: 278 }));
    expect(plan).toEqual({ kind: "direct", mediaId: "media-9" });
  });

  it("reports an unproposable entry when no anchor exists", () => {
    const plan = planWatchlistPropose(makeEntry({ media_id: null, tmdb_id: null, mal_id: null }));
    expect(plan).toEqual({ kind: "unproposable" });
  });
});

describe("isWatchlistEntryProposed", () => {
  it("is true when this session just proposed the entry", () => {
    const entry = makeEntry({ media_id: null, tmdb_id: 278 });
    expect(isWatchlistEntryProposed(entry, new Set(), true)).toBe(true);
  });

  it("is true when an imported entry's media id is in the live queue", () => {
    const entry = makeEntry({ media_id: "media-1" });
    expect(isWatchlistEntryProposed(entry, new Set(["media-1"]), false)).toBe(true);
  });

  it("is false when an imported entry is not in the queue", () => {
    const entry = makeEntry({ media_id: "media-1" });
    expect(isWatchlistEntryProposed(entry, new Set(["media-other"]), false)).toBe(false);
  });

  it("is false for an external-only entry the queue can't key yet", () => {
    // An un-imported entry has no media_id to match the queue; only the local
    // just-proposed flag can mark it proposed before a reload re-keys it.
    const entry = makeEntry({ media_id: null, tmdb_id: 278 });
    expect(isWatchlistEntryProposed(entry, new Set(["media-1"]), false)).toBe(false);
  });

  it("lets the live queue override a stale local flag once the entry has a media id", () => {
    // After an import-then-propose backfill the entry carries a media_id. If the
    // title is later watched it leaves the queue, and isProposed must flip back
    // to false so "Propose" reappears — the sticky local flag must NOT pin it
    // proposed forever.
    const entry = makeEntry({ media_id: "media-1" });
    expect(isWatchlistEntryProposed(entry, new Set(), true)).toBe(false);
  });
});
