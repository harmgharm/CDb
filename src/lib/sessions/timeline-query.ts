/**
 * Assembles the Database timeline payload: the watch-session diary, read down
 * the time axis, with the per-entry facts the timeline card shows (attendees,
 * a per-session group rating, and the "take" quote).
 *
 * Kept out of the route handler so the route stays a thin GET; the per-session
 * derivations (rating average, take) reuse the tested helpers in ./timeline.
 */

import { sql } from "kysely";

import { db } from "@/lib/db";
import type { MediaType } from "@/lib/db/types";

import {
  resolveSessionRating,
  resolveSessionTake,
  type SessionRatingRow,
  weekNumber,
} from "./timeline";

export interface TimelineFilters {
  type?: MediaType;
  search?: string;
  /** Chronological order of entries. Defaults to newest-first. */
  order?: "asc" | "desc";
  page: number;
  limit: number;
}

export interface TimelineAttendee {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface TimelineEntry {
  sessionId: string;
  mediaId: string;
  title: string;
  type: MediaType;
  posterUrl: string | null;
  dateWatched: string | null;
  /** Week number relative to the group's first session (1-based, ascending). */
  week: number | null;
  pickerName: string | null;
  rating: { average: number; count: number } | null;
  attendees: TimelineAttendee[];
  attendeeCount: number;
  take: { text: string; by: string | null } | null;
}

export interface TimelinePayload {
  items: TimelineEntry[];
  page: number;
  limit: number;
  /** Total number of attendees across the group, for "X of Y showed". */
  groupSize: number;
  hasMore: boolean;
}

/**
 * Reduce a Postgres `date` value to its `YYYY-MM-DD` calendar day. The neon
 * driver returns a `date` column as a UTC-midnight `Date`, so the UTC parts are
 * the calendar day Postgres holds; a bare string is already in that form.
 */
function toDateKey(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export async function fetchSessionTimeline(filters: TimelineFilters): Promise<TimelinePayload> {
  const { type, search, page, limit } = filters;
  const order = filters.order ?? "desc";
  const offset = (page - 1) * limit;

  let base = db
    .selectFrom("watch_sessions")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .leftJoin("users as picker", "picker.id", "watch_sessions.picked_by_user_id")
    .leftJoin("users as creator", "creator.id", "watch_sessions.created_by_user_id")
    .select([
      "watch_sessions.id as session_id",
      "watch_sessions.date_watched",
      "watch_sessions.notes",
      "media.id as media_id",
      "media.title as media_title",
      "media.type as media_type",
      "media.poster_url as media_poster_url",
      "picker.username as picker_username",
      "picker.display_name as picker_display_name",
      "creator.username as creator_username",
      "creator.display_name as creator_display_name",
    ]);

  if (type !== undefined) {
    base = base.where("media.type", "=", type);
  }
  if (search !== undefined && search.length > 0) {
    base = base.where("media.title", "ilike", `%${search}%`);
  }

  // One extra row tells us whether another page exists without a second count
  // query. We slice it back off before mapping. Dateless sessions stay last in
  // both directions (they have no chronological position to sort into).
  const rows = await base
    .orderBy(
      order === "asc"
        ? sql`watch_sessions.date_watched asc nulls last`
        : sql`watch_sessions.date_watched desc nulls last`,
    )
    .orderBy("watch_sessions.created_at", order)
    .offset(offset)
    .limit(limit + 1)
    .execute();

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const sessionIds = pageRows.map((r) => r.session_id);

  const [attendeesBySession, ratingsBySession, groupSize, firstWatched] = await Promise.all([
    fetchAttendees(sessionIds),
    fetchRatings(sessionIds),
    fetchGroupSize(),
    fetchFirstWatched(),
  ]);

  const items: TimelineEntry[] = pageRows.map((row) => {
    const attendees = attendeesBySession.get(row.session_id) ?? [];
    const ratings = ratingsBySession.get(row.session_id) ?? [];
    const dateWatched = row.date_watched === null ? null : toDateKey(row.date_watched);

    return {
      sessionId: row.session_id,
      mediaId: row.media_id,
      title: row.media_title,
      type: row.media_type,
      posterUrl: row.media_poster_url,
      dateWatched,
      week: weekNumber(dateWatched, firstWatched),
      pickerName: row.picker_display_name ?? row.picker_username,
      rating: resolveSessionRating(ratings),
      attendees,
      attendeeCount: attendees.length,
      take: resolveSessionTake({
        ratings,
        notes: row.notes,
        creatorName: row.creator_display_name ?? row.creator_username,
      }),
    };
  });

  return { items, page, limit, groupSize, hasMore };
}

async function fetchAttendees(
  sessionIds: readonly string[],
): Promise<Map<string, TimelineAttendee[]>> {
  const map = new Map<string, TimelineAttendee[]>();
  if (sessionIds.length === 0) {
    return map;
  }
  const rows = await db
    .selectFrom("session_attendees")
    .innerJoin("users", "users.id", "session_attendees.user_id")
    .select([
      "session_attendees.session_id",
      "users.id",
      "users.username",
      "users.display_name",
      "users.avatar_url",
    ])
    .where("session_attendees.session_id", "in", sessionIds)
    .execute();

  for (const row of rows) {
    const list = map.get(row.session_id) ?? [];
    list.push({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
    });
    map.set(row.session_id, list);
  }
  return map;
}

async function fetchRatings(
  sessionIds: readonly string[],
): Promise<Map<string, SessionRatingRow[]>> {
  const map = new Map<string, SessionRatingRow[]>();
  if (sessionIds.length === 0) {
    return map;
  }
  const rows = await db
    .selectFrom("ratings")
    .innerJoin("users", "users.id", "ratings.user_id")
    .select([
      "ratings.session_id",
      "ratings.score",
      "ratings.review",
      "ratings.created_at",
      "users.username",
      "users.display_name",
    ])
    .where("ratings.session_id", "in", sessionIds)
    .execute();

  for (const row of rows) {
    const list = map.get(row.session_id) ?? [];
    list.push({
      score: Number(row.score),
      review: row.review,
      username: row.username,
      display_name: row.display_name,
      created_at: new Date(row.created_at),
    });
    map.set(row.session_id, list);
  }
  return map;
}

async function fetchGroupSize(): Promise<number> {
  const result = await db
    .selectFrom("users")
    .select((eb) => eb.fn.countAll().as("count"))
    .executeTakeFirst();
  return Number(result?.count ?? 0);
}

async function fetchFirstWatched(): Promise<string | null> {
  const result = await db
    .selectFrom("watch_sessions")
    .select("date_watched")
    .where("date_watched", "is not", null)
    .orderBy("date_watched", "asc")
    .limit(1)
    .executeTakeFirst();
  if (result?.date_watched == null) {
    return null;
  }
  return toDateKey(result.date_watched);
}
