/**
 * Timeline diary helpers for the Database timeline view.
 *
 * The timeline reads the watch-session log down the time axis. Two derived
 * facts per entry need a small amount of logic that is worth testing in
 * isolation: the per-session group rating, and the "take" (the one quote we
 * surface for the night).
 */

/** A single rating on a session, as joined with its rater for the timeline. */
export interface SessionRatingRow {
  /** decimal(3,1) from Postgres; already coerced to a number by the caller. */
  score: number;
  review: string | null;
  username: string;
  display_name: string | null;
  created_at: Date;
}

/** The per-session group rating shown in the timeline's star slot. */
export interface SessionRating {
  /** Average score across the session's ratings, to one decimal place. */
  average: number;
  count: number;
}

/** The resolved quote for a timeline entry, with optional attribution. */
export interface SessionTake {
  text: string;
  /** Display name (or username) of the attributed person, or null. */
  by: string | null;
}

interface ResolveTakeInput {
  ratings: readonly SessionRatingRow[];
  notes: string | null;
  /** Display name (or username) of the session creator, for the notes fallback. */
  creatorName: string | null;
}

function hasText(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

function raterName(row: SessionRatingRow): string {
  return row.display_name ?? row.username;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whole weeks elapsed between two instants, as a 1-based count: the same instant
 * is week 1, seven days later is week 2, and so on (never below 1). Both the
 * timeline's per-entry "Wk N" label and the masthead's "N weeks in" footnote
 * derive from this, so they share one anchor and never disagree.
 */
export function deriveWeeksSince(fromMs: number, toMs: number): number {
  return Math.max(1, Math.floor((toMs - fromMs) / WEEK_MS) + 1);
}

/**
 * The timeline's "Wk N" label for a session: 1-based weeks from the group's
 * first session date to this session's date. Null when either date is missing.
 * Both args are "YYYY-MM-DD" strings (parsed as UTC midnight, so consistent).
 */
export function weekNumber(date: string | null, firstWatched: string | null): number | null {
  if (date === null || firstWatched === null) {
    return null;
  }
  const ms = new Date(date).getTime();
  const firstMs = new Date(firstWatched).getTime();
  if (Number.isNaN(ms) || Number.isNaN(firstMs)) {
    return null;
  }
  return deriveWeeksSince(firstMs, ms);
}

/**
 * Average the session's ratings to one decimal place. Returns null when the
 * session has no ratings yet, in which case the timeline omits the star.
 */
export function resolveSessionRating(ratings: readonly SessionRatingRow[]): SessionRating | null {
  if (ratings.length === 0) {
    return null;
  }
  const sum = ratings.reduce((total, r) => total + r.score, 0);
  const average = Math.round((sum / ratings.length) * 10) / 10;
  return { average, count: ratings.length };
}

/**
 * Pick the one quote to surface for the night.
 *
 * Priority:
 *   1. A rating review, attributed to its rater. When several reviewed, the
 *      highest-scoring rater wins; ties break toward the oldest review (the
 *      first hot take of the night, not a later echo).
 *   2. Session notes, attributed to the session creator (or unattributed when
 *      the creator is unknown).
 *   3. Nothing — the take line is omitted.
 *
 * Whitespace-only reviews and notes count as absent.
 */
export function resolveSessionTake(input: ResolveTakeInput): SessionTake | null {
  const reviewed = input.ratings
    .filter((r) => hasText(r.review))
    .toSorted((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Tie on score: oldest review wins (first hot take of the night).
      return a.created_at.getTime() - b.created_at.getTime();
    });

  const top = reviewed[0];
  if (top !== undefined && hasText(top.review)) {
    return { text: top.review.trim(), by: raterName(top) };
  }

  if (hasText(input.notes)) {
    return { text: input.notes.trim(), by: input.creatorName };
  }

  return null;
}
