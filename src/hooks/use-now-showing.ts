/**
 * SWR hook backing the dashboard "Now Showing" cards.
 *
 * Surfaces the current user's two most recent watch sessions and classifies
 * each by whether the user has logged their own rating yet:
 *   - "rated"       — the user has a rating for this session
 *   - "in-progress" — the session is logged but the user still owes a rating
 *
 * The "next" / upcoming pick is intentionally NOT shown here. It lives in the
 * sidebar Up Next card (Phase 1) and duplicating that poster moment on the
 * dashboard would be redundant.
 *
 * Composes two existing endpoints (no new API route):
 *   - GET /api/sessions?userId={me}&limit=5  → media + picker + date
 *   - GET /api/ratings?userId={me}           → which sessions the user rated
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
}

interface SessionListResponse {
  readonly items: readonly SessionRow[];
  readonly page: number;
  readonly limit: number;
}

/** One row from GET /api/ratings (shape mirrors the route's select list). */
export interface RatingRow {
  readonly id: string;
  readonly session_id: string;
  readonly score: number;
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
}

export interface UseNowShowingResult {
  /** The two most recent sessions, classified rated / in-progress. */
  readonly items: readonly NowShowingItem[];
  readonly isLoading: boolean;
}

const EMPTY: UseNowShowingResult = { items: [], isLoading: false };

function classify(session: SessionRow, ratedSessionIds: ReadonlySet<string>): NowShowingItem {
  const status: NowShowingStatus = ratedSessionIds.has(session.id) ? "rated" : "in-progress";
  return {
    sessionId: session.id,
    mediaId: session.media_id,
    title: session.media_title,
    posterUrl: session.media_poster_url,
    mediaType: session.media_type,
    href: `/database/${session.media_id}`,
    status,
    dateWatched: session.date_watched,
  };
}

/**
 * Pure core: take the user's recent sessions and their ratings, keep the two
 * most recent, and classify each as rated / in-progress. Extracted from the
 * hook so the classification is testable without SWR or React.
 */
export function selectNowShowing(
  sessions: readonly SessionRow[],
  ratings: readonly RatingRow[],
): { items: readonly NowShowingItem[] } {
  const ratedSessionIds = new Set(ratings.map((rating) => rating.session_id));
  const items = sessions
    .slice(0, NOW_SHOWING_COUNT)
    .map((session) => classify(session, ratedSessionIds));
  return { items };
}

export function useNowShowing(): UseNowShowingResult {
  const { user } = useAuth();
  const userId = user?.id;

  const sessionsKey =
    userId === undefined
      ? null
      : `/api/sessions?userId=${userId}&limit=${String(NOW_SHOWING_COUNT)}`;
  const ratingsKey = userId === undefined ? null : `/api/ratings?userId=${userId}`;

  const sessions = useSWR<SessionListResponse>(sessionsKey);
  const ratings = useSWR<readonly RatingRow[]>(ratingsKey);

  if (userId === undefined) {
    return EMPTY;
  }

  // Classification needs BOTH responses. While either is pending, report
  // loading rather than classifying with partial data (which would flash
  // already-rated sessions as "in progress" until ratings arrive).
  const isLoading = sessions.isLoading || ratings.isLoading;
  const sessionItems = sessions.data?.items;
  if (sessionItems === undefined || ratings.data === undefined) {
    return { ...EMPTY, isLoading };
  }

  return { ...selectNowShowing(sessionItems, ratings.data), isLoading };
}
