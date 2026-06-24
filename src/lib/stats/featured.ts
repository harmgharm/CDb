/**
 * Featured media query for the Database editorial band.
 *
 * Split out of `queries.ts` so each stats module stays focused. Ranks media by
 * the group's average rating, optionally scoped to a month.
 */

import { db } from "@/lib/db";
import type { MediaType } from "@/lib/db/types";
import type { FeaturedMedia, FeaturedPerson } from "@/types/detailed-stats";

interface FeaturedMediaRow {
  id: string;
  title: string;
  type: string;
  poster_url: string | null;
  avg_score: string | number;
  rating_count: string | number | bigint;
  release_year: number | null;
  runtime_minutes: number | null;
  episode_count: number | null;
}

/**
 * Top-rated media for the Database "Featured" band, ranked by the group's
 * average rating. When `monthStart` is provided, only sessions watched on or
 * after that date count (used for "highest rated this month"); otherwise the
 * ranking is all-time. Requires at least 2 ratings so a single outlier score
 * can't headline the band.
 *
 * Returns the meta fields the band's card needs (year, runtime, episode count)
 * alongside the rating aggregates. The caller takes the first row as the
 * headline and the next few as the supporting stack.
 */
export async function fetchFeaturedMedia(
  limit: number,
  monthStart?: Date,
): Promise<FeaturedMediaRow[]> {
  let query = db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id");

  if (monthStart !== undefined) {
    query = query.where("watch_sessions.date_watched", ">=", monthStart);
  }

  return query
    .select([
      "media.id",
      "media.title",
      "media.type",
      "media.poster_url",
      "media.release_year",
      "media.runtime_minutes",
      "media.episode_count",
      db.fn.avg("ratings.score").as("avg_score"),
      db.fn.countAll().as("rating_count"),
    ])
    .groupBy([
      "media.id",
      "media.title",
      "media.type",
      "media.poster_url",
      "media.release_year",
      "media.runtime_minutes",
      "media.episode_count",
    ])
    .having(db.fn.countAll(), ">=", 2)
    .orderBy("avg_score", "desc")
    .limit(limit)
    .execute();
}

export function formatFeaturedMedia(rows: readonly FeaturedMediaRow[]): FeaturedMedia[] {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type as MediaType,
    posterUrl: r.poster_url,
    avgScore: Math.round(Number(r.avg_score) * 10) / 10,
    ratingCount: Number(r.rating_count),
    releaseYear: r.release_year,
    runtimeMinutes: r.runtime_minutes,
    episodeCount: r.episode_count,
    // Lineage (picker/attendees) is attached separately via attachFeaturedLineage.
    picker: null,
    attendees: [],
  }));
}

/**
 * A media's watched queue proposal, reduced to the fields the recency tie-break
 * needs. `dateWatched` is the session's calendar watch date (a `YYYY-MM-DD`
 * string, nullable — the log form makes it optional); `createdAt` is when the
 * session row was inserted (always present). Callers carry the rest of the row
 * alongside.
 */
export interface WatchedProposalRef {
  dateWatched: string | null;
  createdAt: string;
}

/**
 * Order two watched proposals by recency: later `dateWatched` first, a present
 * date always ahead of a null one (NULLS LAST), `createdAt` as the tiebreak.
 * Returns negative when `a` is more recent than `b`.
 *
 * This mirrors the repo's `date_watched DESC NULLS LAST, created_at DESC` SQL
 * pattern (src/lib/users/stats.ts) and deliberately compares the two keys
 * separately — collapsing a `date` and a `timestamptz` into one value (e.g. via
 * SQL `COALESCE`) casts the date to session-midnight and can misorder a dated
 * row behind a null-dated one logged later the same day.
 */
function compareByRecency(a: WatchedProposalRef, b: WatchedProposalRef): number {
  if (a.dateWatched !== b.dateWatched) {
    if (a.dateWatched === null) return 1; // a is null -> a sorts after b
    if (b.dateWatched === null) return -1; // b is null -> a sorts before b
    return a.dateWatched > b.dateWatched ? -1 : 1;
  }
  // Same (or both-null) date -> later createdAt wins. ISO strings compare
  // lexicographically in chronological order.
  if (a.createdAt === b.createdAt) return 0;
  return a.createdAt > b.createdAt ? -1 : 1;
}

/**
 * The "which session?" resolver. A title can be proposed and watched more than
 * once (re-watches), so it can have several watched queue proposals. The most
 * recent one names the canonical session whose picker/attendees the featured
 * card shows. Returns null when the title has no watched proposal at all.
 */
export function selectCanonicalProposal<T extends WatchedProposalRef>(
  proposals: readonly T[],
): T | null {
  let best: T | null = null;
  for (const p of proposals) {
    if (best === null || compareByRecency(p, best) < 0) {
      best = p;
    }
  }
  return best;
}

/** Picker + attendees for a featured title's canonical session. */
export interface FeaturedLineage {
  picker: FeaturedPerson | null;
  attendees: FeaturedPerson[];
}

/**
 * Attach each featured media's lineage (picker + attendees) by id. A media with
 * no entry in the map keeps the formatter's defaults (null picker, no attendees),
 * so off-queue / pre-queue titles render today's card unchanged.
 */
export function attachFeaturedLineage(
  media: readonly FeaturedMedia[],
  lineageByMediaId: ReadonlyMap<string, FeaturedLineage>,
): FeaturedMedia[] {
  return media.map((m) => {
    const lineage = lineageByMediaId.get(m.id);
    if (lineage === undefined) {
      return m;
    }
    return { ...m, picker: lineage.picker, attendees: lineage.attendees };
  });
}

interface WatchedProposalRow {
  media_id: string;
  session_id: string;
  date_watched: Date | string | null;
  created_at: Date | string;
  picker_username: string | null;
  picker_display_name: string | null;
  picker_avatar_url: string | null;
}

/**
 * Reduce a Postgres `date` value to its `YYYY-MM-DD` calendar day. The neon
 * driver returns a `date` column as a UTC-midnight `Date`, so the UTC date parts
 * are the calendar day Postgres holds (matches `formatScheduledDate`'s
 * `timeZone: "UTC"` reading). A bare string is already in `YYYY-MM-DD` form.
 */
function toDateKey(value: Date | string): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

interface AttendeeRow {
  session_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * Build the picker + attendee lineage for the given featured media, keyed by
 * media id, from the group queue's proposer/session lineage.
 *
 * The "which session?" ambiguity (a featured title can have several sessions)
 * is resolved by the queue: each watched proposal links the canonical session
 * it was watched in (`watched_session_id`). Re-watches give a title several
 * watched proposals, so `selectCanonicalProposal` takes the most recent. The
 * picker is that session's `picked_by_user_id`; the attendees are its
 * `session_attendees`. A media with no watched proposal is simply absent from
 * the map (the card then shows no picker / no stack).
 */
export async function fetchFeaturedLineage(
  mediaIds: readonly string[],
): Promise<Map<string, FeaturedLineage>> {
  const result = new Map<string, FeaturedLineage>();
  if (mediaIds.length === 0) {
    return result;
  }

  // 1. All watched proposals for these media, with the linked session's watch
  //    date + insertion time and the session picker. The pure tie-break keeps
  //    the most recent per media (date_watched DESC NULLS LAST, created_at DESC
  //    — kept as two separate keys, never collapsed into a mixed date/timestamp
  //    value, which would misorder a dated row behind a null-dated one).
  const proposals = (await db
    .selectFrom("queue_proposals")
    .innerJoin("watch_sessions", "watch_sessions.id", "queue_proposals.watched_session_id")
    .leftJoin("users", "users.id", "watch_sessions.picked_by_user_id")
    .select([
      "queue_proposals.media_id as media_id",
      "watch_sessions.id as session_id",
      "watch_sessions.date_watched as date_watched",
      "watch_sessions.created_at as created_at",
      "users.username as picker_username",
      "users.display_name as picker_display_name",
      "users.avatar_url as picker_avatar_url",
    ])
    .where("queue_proposals.status", "=", "watched")
    .where("queue_proposals.media_id", "in", mediaIds)
    .execute()) as WatchedProposalRow[];

  // Group watched proposals by media, then pick the canonical (most recent) one.
  const byMedia = new Map<string, WatchedProposalRow[]>();
  for (const row of proposals) {
    const list = byMedia.get(row.media_id) ?? [];
    list.push(row);
    byMedia.set(row.media_id, list);
  }

  const canonicalByMedia = new Map<string, WatchedProposalRow>();
  for (const [mediaId, rows] of byMedia) {
    const canonical = selectCanonicalProposal(
      rows.map((r) => ({
        ...r,
        // date_watched is a calendar date; reduce to its YYYY-MM-DD so the
        // string compare in compareByRecency is by calendar day, not time.
        dateWatched: r.date_watched === null ? null : toDateKey(r.date_watched),
        createdAt: new Date(r.created_at).toISOString(),
      })),
    );
    if (canonical !== null) {
      canonicalByMedia.set(mediaId, canonical);
    }
  }

  if (canonicalByMedia.size === 0) {
    return result;
  }

  // 2. Attendees for the canonical sessions, keyed by session id.
  const sessionIds = [...canonicalByMedia.values()].map((r) => r.session_id);
  const attendeeRows = (await db
    .selectFrom("session_attendees")
    .innerJoin("users", "users.id", "session_attendees.user_id")
    .select([
      "session_attendees.session_id as session_id",
      "users.username as username",
      "users.display_name as display_name",
      "users.avatar_url as avatar_url",
    ])
    .where("session_attendees.session_id", "in", sessionIds)
    .execute()) as AttendeeRow[];

  const attendeesBySession = new Map<string, FeaturedPerson[]>();
  for (const row of attendeeRows) {
    const list = attendeesBySession.get(row.session_id) ?? [];
    list.push({
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
    });
    attendeesBySession.set(row.session_id, list);
  }

  // 3. Assemble lineage per media.
  for (const [mediaId, canonical] of canonicalByMedia) {
    const picker =
      canonical.picker_username === null
        ? null
        : {
            username: canonical.picker_username,
            displayName: canonical.picker_display_name,
            avatarUrl: canonical.picker_avatar_url,
          };
    result.set(mediaId, {
      picker,
      attendees: attendeesBySession.get(canonical.session_id) ?? [],
    });
  }

  return result;
}
