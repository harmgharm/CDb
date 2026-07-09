/**
 * GET /api/media/[id] — Media detail with sessions and ratings
 * PATCH /api/media/[id] — Update media (admin only)
 * DELETE /api/media/[id] — Delete media (admin only)
 */

import { sql } from "kysely";
import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAuthUser, getModeratorUser, logAudit } from "@/lib/auth";
import { db } from "@/lib/db";
import { withTransaction } from "@/lib/db/transaction";
import { publishToQueue } from "@/lib/notifications";
import { ensureScheduledFilled } from "@/lib/queue/ensure-scheduled";
import { QUEUE_EVENTS } from "@/lib/queue/realtime";
import type { UpdateMediaInput } from "@/lib/validations/media";
import { updateMediaSchema } from "@/lib/validations/media";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const _user = await getAuthUser();
  if (!_user) {
    return errorResponse("Not authenticated", 401);
  }
  const { id } = await params;

  const media = await db.selectFrom("media").selectAll().where("id", "=", id).executeTakeFirst();

  if (!media) {
    return errorResponse("Media not found", 404);
  }

  // Fetch sessions with picker info
  const sessions = await db
    .selectFrom("watch_sessions")
    .leftJoin("users", "users.id", "watch_sessions.picked_by_user_id")
    .select([
      "watch_sessions.id",
      "watch_sessions.date_watched",
      "watch_sessions.time_watched_at",
      "watch_sessions.notes",
      "watch_sessions.created_at",
      "watch_sessions.created_by_user_id",
      "users.id as picker_id",
      "users.username as picker_username",
      "users.display_name as picker_display_name",
      "users.avatar_url as picker_avatar_url",
    ])
    .where("watch_sessions.media_id", "=", id)
    .orderBy(sql`watch_sessions.date_watched desc nulls last`)
    .execute();

  // Fetch all attendees for this media's sessions
  const sessionIds = sessions.map((s) => s.id);
  const attendees =
    sessionIds.length > 0
      ? await db
          .selectFrom("session_attendees")
          .innerJoin("users", "users.id", "session_attendees.user_id")
          .select([
            "session_attendees.session_id",
            "users.id as user_id",
            "users.username",
            "users.display_name",
            "users.avatar_url",
          ])
          .where("session_attendees.session_id", "in", sessionIds)
          .execute()
      : [];

  // Group attendees by session
  const attendeesBySession = new Map<string, typeof attendees>();
  for (const attendee of attendees) {
    const list = attendeesBySession.get(attendee.session_id) ?? [];
    list.push(attendee);
    attendeesBySession.set(attendee.session_id, list);
  }

  const sessionsWithAttendees = sessions.map((session) => ({
    ...session,
    attendees: (attendeesBySession.get(session.id) ?? []).map((a) => ({
      user_id: a.user_id,
      username: a.username,
      display_name: a.display_name,
      avatar_url: a.avatar_url,
    })),
  }));

  // Fetch all ratings for this media across sessions
  const ratings = await db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .innerJoin("users", "users.id", "ratings.user_id")
    .select([
      "ratings.id",
      "ratings.session_id",
      "ratings.score",
      "ratings.review",
      "ratings.created_at",
      "users.id as user_id",
      "users.username",
      "users.display_name",
      "users.avatar_url",
    ])
    .where("watch_sessions.media_id", "=", id)
    .execute();

  // Convert decimal scores to numbers (Postgres returns decimal as string)
  const normalizedRatings = ratings.map((r) => ({ ...r, score: Number(r.score) }));
  const scores = normalizedRatings.map((r) => r.score);
  const avgRating = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const roundedAvg = avgRating === null ? null : Math.round(avgRating * 10) / 10;

  return successResponse({
    ...media,
    // Mirror the list endpoint's group-average field so MediaDetail (which
    // extends MediaListItem) is consistent; same value as stats.avgRating.
    avg_rating: roundedAvg,
    sessions: sessionsWithAttendees,
    ratings: normalizedRatings,
    stats: {
      sessionCount: sessions.length,
      ratingCount: ratings.length,
      avgRating: roundedAvg,
    },
  });
}

/** Maps camelCase input keys to snake_case DB columns */
const FIELD_MAP: Record<string, string> = {
  title: "title",
  type: "type",
  tmdbId: "tmdb_id",
  malId: "mal_id",
  posterUrl: "poster_url",
  backdropUrl: "backdrop_url",
  synopsis: "synopsis",
  releaseYear: "release_year",
  runtimeMinutes: "runtime_minutes",
  episodeCount: "episode_count",
  imdbId: "imdb_id",
  tmdbRating: "tmdb_rating",
  malScore: "mal_score",
  status: "status",
  originalTitle: "original_title",
  tagline: "tagline",
  voteCount: "vote_count",
  seasonCount: "season_count",
  trailerKey: "trailer_key",
  certification: "certification",
  budget: "budget",
  revenue: "revenue",
};

/** Fields that need JSON.stringify before storage */
const JSON_FIELD_MAP: Record<string, string> = {
  genres: "genres",
  directors: "directors",
  originCountry: "origin_country",
  networks: "networks",
  studios: "studios",
};

function buildMediaUpdateSet(data: UpdateMediaInput): Record<string, unknown> {
  const fields: Record<string, unknown> = { updated_at: new Date() };

  for (const [key, column] of Object.entries(FIELD_MAP)) {
    const value = data[key as keyof UpdateMediaInput];
    if (value !== undefined) {
      fields[column] = value;
    }
  }

  for (const [key, column] of Object.entries(JSON_FIELD_MAP)) {
    const value = data[key as keyof UpdateMediaInput];
    if (value !== undefined) {
      fields[column] = JSON.stringify(value);
    }
  }

  return fields;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const admin = await getModeratorUser();
  if (!admin) {
    return errorResponse("Not authorized", 403);
  }
  const { id } = await params;

  const media = await db.selectFrom("media").select("id").where("id", "=", id).executeTakeFirst();
  if (!media) {
    return errorResponse("Media not found", 404);
  }

  const body: unknown = await req.json();
  const parsed = updateMediaSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const data = parsed.data;
  const updated = await db
    .updateTable("media")
    .set(buildMediaUpdateSet(data))
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAudit({
    userId: admin.id,
    action: "media.updated",
    entityType: "media",
    entityId: id,
    metadata: data,
  });

  return successResponse(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const admin = await getModeratorUser();
  if (!admin) {
    return errorResponse("Not authorized", 403);
  }
  const { id } = await params;

  const media = await db
    .selectFrom("media")
    .select(["id", "title"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!media) {
    return errorResponse("Media not found", 404);
  }

  // Deleting media FK-cascades away any queue proposal for it. If that proposal
  // was the scheduled pick, the slot is now empty and the cascade bypassed
  // ensureScheduledFilled — so re-fill it in the same transaction. Capture the
  // proposal id up front (before the cascade erases it) for an honest broadcast.
  // The active-per-media unique index means at most one such row.
  const activeProposal = await db
    .selectFrom("queue_proposals")
    .select("id")
    .where("media_id", "=", id)
    .where("status", "in", ["proposed", "scheduled"])
    .executeTakeFirst();

  await withTransaction(async (trx) => {
    await trx.deleteFrom("media").where("id", "=", id).execute();
    if (activeProposal !== undefined) {
      await ensureScheduledFilled(trx);
    }
  });

  await logAudit({
    userId: admin.id,
    action: "media.deleted",
    entityType: "media",
    entityId: id,
    metadata: { title: media.title },
  });

  // A queued title was deleted out from under the queue — tell clients to
  // revalidate; the GET reflects the cascade removal and any slot re-fill.
  if (activeProposal !== undefined) {
    publishToQueue(QUEUE_EVENTS.removed, { proposalId: activeProposal.id });
  }

  return successResponse(null, "Media deleted");
}
