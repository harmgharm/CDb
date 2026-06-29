/**
 * Pure helpers for shaping a media-list row before it leaves the API.
 *
 * The list query attaches a correlated `AVG(r.score)` subquery as `avg_rating`
 * (the group's average rating for a title). Postgres returns `AVG()` as a
 * numeric *string*, and the column is only present once selected, so the raw
 * value is `string | number | null | undefined`. These helpers coerce it to a
 * clean `number | null` rounded to one decimal — matching how the media-detail
 * endpoint rounds its `avgRating` — so the grid card can render the score badge
 * without re-parsing on the client.
 *
 * Split out as pure functions so they're unit-testable without a database (the
 * route's own SQL is exercised separately).
 */

/** A raw list row may or may not carry the `avg_rating` aggregate. */
type RawAvgRating = string | number | null | undefined;

/**
 * Coerce a raw `AVG(score)` value to a one-decimal number, or null when there
 * is no rating (null/undefined) or the value isn't a finite number.
 */
export function coerceAvgRating(raw: RawAvgRating): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 10) / 10;
}

/**
 * Return the row with its `avg_rating` normalised to `number | null`. Other
 * fields pass through untouched. Generic so it composes with whatever wide row
 * shape the query produces, without restating every media column here.
 */
export function mapMediaListRow<T extends { avg_rating?: RawAvgRating }>(
  row: T,
): Omit<T, "avg_rating"> & { avg_rating: number | null } {
  return { ...row, avg_rating: coerceAvgRating(row.avg_rating) };
}
