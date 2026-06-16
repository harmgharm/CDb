/**
 * Featured media query for the Database editorial band.
 *
 * Split out of `queries.ts` so each stats module stays focused. Ranks media by
 * the group's average rating, optionally scoped to a month.
 */

import { db } from "@/lib/db";
import type { MediaType } from "@/lib/db/types";

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

export function formatFeaturedMedia(rows: readonly FeaturedMediaRow[]) {
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
  }));
}
