/**
 * Viewing-habits queries for the dashboard "Viewing habits" card.
 *
 * Split out of `queries.ts` so each stats module stays focused. Two aggregates
 * power the card alongside the existing streak / avg-start-time data:
 *
 *   - A Monday-first day-of-week session histogram (the 7-bar chart).
 *   - The average session length (the "Avg length" meta cell).
 *
 * The DB functions stay thin (a single SELECT each); the bucketing, peak
 * detection, averaging and formatting live in pure helpers so they can be unit
 * tested without a live database (mirrors `featured.ts`).
 */

import { sql } from "kysely";

import { db } from "@/lib/db";

/** Kysely aggregate return types (string | number | bigint from COUNT/SUM). */
type KyselyCount = string | number | bigint;

/** Monday-first weekday labels, the order the chart renders. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface WeekdayBucket {
  readonly day: Weekday;
  readonly count: number;
  /** True for the single busiest day, used to highlight one amber bar. */
  readonly isPeak: boolean;
}

/** A row of the day-of-week aggregate: Postgres DOW (0=Sun..6=Sat) + a count. */
export interface WeekdayCountRow {
  readonly dow: number;
  readonly count: KyselyCount;
}

/**
 * Map Postgres `EXTRACT(DOW)` (0=Sunday) onto the Monday-first index used by
 * WEEKDAYS (0=Monday..6=Sunday).
 */
function dowToMondayIndex(dow: number): number {
  return (dow + 6) % 7;
}

/**
 * Build the seven Monday-through-Sunday buckets from a sparse day-of-week
 * aggregate. Missing weekdays fill in as zero. Exactly one day is flagged as
 * the peak: the busiest, breaking ties toward the earlier weekday so a single
 * bar highlights. No day is flagged when every count is zero.
 */
export function buildWeekdayHistogram(rows: readonly WeekdayCountRow[]): WeekdayBucket[] {
  const counts = WEEKDAYS.map(() => 0);
  for (const row of rows) {
    const index = dowToMondayIndex(row.dow);
    if (index >= 0 && index < counts.length) {
      counts[index] = Number(row.count);
    }
  }

  const max = Math.max(...counts);
  const peakIndex = max > 0 ? counts.indexOf(max) : -1;

  return WEEKDAYS.map((day, index) => ({
    day,
    count: counts[index] ?? 0,
    isPeak: index === peakIndex,
  }));
}

/** A row of the avg-session-length aggregate: one session's total runtime. */
export interface SessionMinutesRow {
  readonly minutes: KyselyCount;
}

/**
 * Average the per-session minutes, ignoring sessions with zero runtime (media
 * missing runtime data) so absent data neither sums in nor inflates the
 * divisor. Returns null when no session has a known runtime.
 */
export function computeAvgSessionMinutes(rows: readonly SessionMinutesRow[]): number | null {
  let total = 0;
  let counted = 0;
  for (const row of rows) {
    const minutes = Number(row.minutes);
    if (minutes > 0) {
      total += minutes;
      counted += 1;
    }
  }
  if (counted === 0) return null;
  return Math.round(total / counted);
}

/**
 * Format a minute count as "Xh Ym" (e.g. 138 → "2h 18m"). Drops the hour part
 * below an hour ("45m") and the minute part on a whole hour ("2h"). Null in,
 * null out so the meta cell can be omitted when there is no data.
 */
export function formatSessionLength(minutes: number | null): string | null {
  if (minutes === null) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${String(mins)}m`;
  if (mins === 0) return `${String(hours)}h`;
  return `${String(hours)}h ${String(mins)}m`;
}

/**
 * Session counts grouped by day of week. Postgres `EXTRACT(DOW)` yields
 * 0=Sunday..6=Saturday; the pure `buildWeekdayHistogram` remaps to Monday-first.
 * Only sessions with a `date_watched` count (the same filter as the streak data).
 */
export async function fetchWeekdayCounts(): Promise<WeekdayBucket[]> {
  const rows = await db
    .selectFrom("watch_sessions")
    .select([
      sql<number>`EXTRACT(DOW FROM date_watched)::int`.as("dow"),
      sql<string>`COUNT(*)`.as("count"),
    ])
    .where("date_watched", "is not", null)
    .groupBy(sql`EXTRACT(DOW FROM date_watched)`)
    .execute();

  return buildWeekdayHistogram(rows);
}

/**
 * Average length of a watch session in minutes, formatted as "Xh Ym".
 * Movie length is `runtime_minutes`; TV/anime is `episode_count * runtime_minutes`
 * for the full season, matching `fetchHoursWatched`. One row per session.
 */
export async function fetchAvgSessionLength(): Promise<string | null> {
  const rows = await db
    .selectFrom("watch_sessions")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select(
      sql<string>`
        CASE
          WHEN media.type = 'movie' THEN COALESCE(media.runtime_minutes, 0)
          ELSE COALESCE(media.episode_count, 1) * COALESCE(media.runtime_minutes, 0)
        END
      `.as("minutes"),
    )
    .execute();

  return formatSessionLength(computeAvgSessionMinutes(rows));
}
