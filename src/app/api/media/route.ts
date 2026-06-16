/**
 * GET /api/media — List media with filters, sorting, pagination
 * POST /api/media — Create media entry manually
 */

import { sql } from "kysely";
import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createMediaSchema, mediaQuerySchema } from "@/lib/validations/media";

export async function GET(req: NextRequest) {
  await requireAuth();

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = mediaQuerySchema.safeParse(params);
  if (!parsed.success) {
    return errorResponse("Invalid query parameters", 400);
  }

  const { type, genre, yearFrom, yearTo, search, sortBy, sortOrder, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  // Map the validated sort order to a compile-time SQL literal so the raw-SQL
  // orderBy expressions below never interpolate a request value, even though
  // sortOrder is already constrained to "asc" | "desc" by the schema.
  const sortDirection = sortOrder === "asc" ? sql.raw("asc") : sql.raw("desc");

  let query = db.selectFrom("media").selectAll("media");

  if (type !== undefined) {
    query = query.where("media.type", "=", type);
  }
  if (yearFrom !== undefined) {
    query = query.where("media.release_year", ">=", yearFrom);
  }
  if (yearTo !== undefined) {
    query = query.where("media.release_year", "<=", yearTo);
  }
  if (search !== undefined && search.length > 0) {
    query = query.where("media.title", "ilike", `%${search}%`);
  }
  if (genre !== undefined && genre.length > 0) {
    query = query.where(sql<boolean>`media.genres @> ${JSON.stringify([genre])}::jsonb`);
  }

  // Count total
  const countResult = await db
    .selectFrom("media")
    .select(db.fn.countAll().as("total"))
    .$call((qb) => {
      let q = qb;
      if (type !== undefined) q = q.where("media.type", "=", type);
      if (yearFrom !== undefined) q = q.where("media.release_year", ">=", yearFrom);
      if (yearTo !== undefined) q = q.where("media.release_year", "<=", yearTo);
      if (search !== undefined && search.length > 0)
        q = q.where("media.title", "ilike", `%${search}%`);
      if (genre !== undefined && genre.length > 0)
        q = q.where(sql<boolean>`media.genres @> ${JSON.stringify([genre])}::jsonb`);
      return q;
    })
    .executeTakeFirstOrThrow();

  const total = Number(countResult.total);

  // Sort
  if (sortBy === "date_watched") {
    // Sort by most recent watch session date (subquery)
    const results = await query
      .select(
        sql<Date | null>`(SELECT MAX(ws.date_watched) FROM watch_sessions ws WHERE ws.media_id = media.id)`.as(
          "latest_watched",
        ),
      )
      .orderBy(sql`latest_watched ${sortDirection} nulls last`)
      .offset(offset)
      .limit(limit)
      .execute();

    return successResponse({
      items: results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  if (sortBy === "rating") {
    // Sort by the group's average rating (correlated subquery over ratings).
    const results = await query
      .select(
        sql<number | null>`(
          SELECT AVG(r.score)
          FROM ratings r
          JOIN watch_sessions ws ON ws.id = r.session_id
          WHERE ws.media_id = media.id
        )`.as("avg_rating"),
      )
      .orderBy(sql`avg_rating ${sortDirection} nulls last`)
      .offset(offset)
      .limit(limit)
      .execute();

    return successResponse({
      items: results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  // date_watched and rating are handled by their own branches above.
  const sortColumnMap = {
    title: "media.title",
    release_year: "media.release_year",
    created_at: "media.created_at",
  } as const;
  const sortColumn = sortColumnMap[sortBy];

  const results = await query.orderBy(sortColumn, sortOrder).offset(offset).limit(limit).execute();

  return successResponse({
    items: results,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();

  const body: unknown = await req.json();
  const parsed = createMediaSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const data = parsed.data;

  // Check duplicates by tmdb_id or mal_id
  if (data.tmdbId !== undefined) {
    const existing = await db
      .selectFrom("media")
      .select("id")
      .where("tmdb_id", "=", data.tmdbId)
      .executeTakeFirst();
    if (existing) {
      return errorResponse("Media with this TMDB ID already exists", 409);
    }
  }
  if (data.malId !== undefined) {
    const existing = await db
      .selectFrom("media")
      .select("id")
      .where("mal_id", "=", data.malId)
      .executeTakeFirst();
    if (existing) {
      return errorResponse("Media with this MAL ID already exists", 409);
    }
  }

  const media = await db
    .insertInto("media")
    .values({
      title: data.title,
      type: data.type,
      tmdb_id: data.tmdbId ?? null,
      mal_id: data.malId ?? null,
      poster_url: data.posterUrl ?? null,
      backdrop_url: data.backdropUrl ?? null,
      synopsis: data.synopsis ?? null,
      genres: JSON.stringify(data.genres),
      release_year: data.releaseYear ?? null,
      runtime_minutes: data.runtimeMinutes ?? null,
      episode_count: data.episodeCount ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAudit({
    userId: user.id,
    action: "media.created",
    entityType: "media",
    entityId: media.id,
    metadata: { title: data.title, type: data.type, source: "manual" },
  });

  return successResponse(media, "Media created", 201);
}
