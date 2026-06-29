/**
 * SWR hook backing the dashboard "Now Showing" cards.
 *
 * Surfaces the current user's two most recent watch sessions and classifies
 * each by the GROUP's rating progress (how many attendees have rated):
 *   - "rated"       — every attendee has logged a rating
 *   - "in-progress" — at least one attendee still owes a rating
 *
 * The subline shows the progress as a count ("5 / 5 rated" / "2 still rating"),
 * matching the kit. This is group-level, not "did I personally rate it" — a
 * session is only done when the whole group has rated.
 *
 * The "next" / upcoming pick is intentionally NOT shown here. It lives in the
 * sidebar Up Next card (Phase 1) and duplicating that poster moment on the
 * dashboard would be redundant.
 *
 * Reads one existing endpoint (no new API route): GET /api/sessions carries
 * per-session attendee_count + rated_count (correlated-subquery columns), so no
 * separate ratings fetch is needed.
 */

import useSWR from "swr";

import { useAuth } from "@/components/providers/auth-provider";
import type { MediaType } from "@/lib/db/types";

/** Cards shown, and the number of recent sessions we fetch — they match, so
 *  no session rows are fetched and discarded. */
const NOW_SHOWING_COUNT = 2;

export type NowShowingStatus = "rated" | "in-progress";

/** One row from GET /api/sessions (shape mirrors the route's select list). */
export interface SessionRow {
  readonly id: string;
  readonly date_watched: string | null;
  readonly media_id: string;
  readonly media_title: string;
  readonly media_type: MediaType;
  readonly media_poster_url: string | null;
  /** Attendees recorded on the session. */
  readonly attendee_count: number;
  /** Attendees who have logged a rating for the session. */
  readonly rated_count: number;
}

interface SessionListResponse {
  readonly items: readonly SessionRow[];
  readonly page: number;
  readonly limit: number;
}

export interface NowShowingItem {
  readonly sessionId: string;
  readonly mediaId: string;
  readonly title: string;
  readonly posterUrl: string | null;
  readonly mediaType: MediaType;
  readonly href: string;
  readonly status: NowShowingStatus;
  readonly dateWatched: string | null;
  /** Attendees who have rated, for the "N / M rated" subline. */
  readonly ratedCount: number;
  /** Total attendees, for the "N / M rated" subline. */
  readonly attendeeCount: number;
}

export interface UseNowShowingResult {
  /** The two most recent sessions, classified rated / in-progress. */
  readonly items: readonly NowShowingItem[];
  readonly isLoading: boolean;
}

const EMPTY: UseNowShowingResult = { items: [], isLoading: false };

function classify(session: SessionRow): NowShowingItem {
  // A session with no recorded attendees has nothing pending, so treat it as
  // rated rather than showing a degenerate "0 / 0" still-rating state.
  const status: NowShowingStatus =
    session.attendee_count === 0 || session.rated_count >= session.attendee_count
      ? "rated"
      : "in-progress";
  return {
    sessionId: session.id,
    mediaId: session.media_id,
    title: session.media_title,
    posterUrl: session.media_poster_url,
    mediaType: session.media_type,
    href: `/database/${session.media_id}`,
    status,
    dateWatched: session.date_watched,
    ratedCount: session.rated_count,
    attendeeCount: session.attendee_count,
  };
}

/**
 * Pure core: take the recent sessions, keep the two most recent, and classify
 * each by the group's rating progress. Extracted from the hook so the
 * classification is testable without SWR or React.
 */
export function selectNowShowing(sessions: readonly SessionRow[]): {
  items: readonly NowShowingItem[];
} {
  const items = sessions.slice(0, NOW_SHOWING_COUNT).map((session) => classify(session));
  return { items };
}

export function useNowShowing(): UseNowShowingResult {
  const { user } = useAuth();
  const userId = user?.id;

  const sessionsKey =
    userId === undefined
      ? null
      : `/api/sessions?userId=${userId}&limit=${String(NOW_SHOWING_COUNT)}`;

  const sessions = useSWR<SessionListResponse>(sessionsKey);

  if (userId === undefined) {
    return EMPTY;
  }

  const isLoading = sessions.isLoading;
  const sessionItems = sessions.data?.items;
  if (sessionItems === undefined) {
    return { ...EMPTY, isLoading };
  }

  return { ...selectNowShowing(sessionItems), isLoading };
}
