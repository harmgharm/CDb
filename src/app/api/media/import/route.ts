/**
 * POST /api/media/import
 *
 * Import media from TMDB or Jikan by external ID.
 * Fetches full metadata and creates the media entry.
 */

import type { NextRequest } from "next/server";

import { getAnimeDetails } from "@/lib/api/jikan";
import { errorResponse, successResponse } from "@/lib/api/response";
import { getMovieDetails, getTvDetails, tmdbImageUrl } from "@/lib/api/tmdb";
import { logAudit, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { importMediaSchema } from "@/lib/validations/media";

interface MediaMetadata {
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  synopsis: string | null;
  genres: string[];
  releaseYear: number | null;
  runtimeMinutes: number | null;
  episodeCount: number | null;
}

function parseYear(dateString: string): number | null {
  return dateString.length > 0 ? Number(dateString.slice(0, 4)) : null;
}

async function fetchMovieMetadata(tmdbId: number): Promise<MediaMetadata> {
  const movie = await getMovieDetails(tmdbId);
  return {
    title: movie.title,
    posterUrl: tmdbImageUrl(movie.poster_path),
    backdropUrl: tmdbImageUrl(movie.backdrop_path, "w780"),
    synopsis: movie.overview.length > 0 ? movie.overview : null,
    genres: movie.genres.map((g) => g.name),
    releaseYear: parseYear(movie.release_date),
    runtimeMinutes: movie.runtime,
    episodeCount: null,
  };
}

async function fetchTvMetadata(tmdbId: number): Promise<MediaMetadata> {
  const show = await getTvDetails(tmdbId);
  return {
    title: show.name,
    posterUrl: tmdbImageUrl(show.poster_path),
    backdropUrl: tmdbImageUrl(show.backdrop_path, "w780"),
    synopsis: show.overview.length > 0 ? show.overview : null,
    genres: show.genres.map((g) => g.name),
    releaseYear: parseYear(show.first_air_date),
    runtimeMinutes: show.episode_run_time[0] ?? null,
    episodeCount: show.number_of_episodes,
  };
}

async function fetchAnimeMetadata(malId: number): Promise<MediaMetadata> {
  const { data: anime } = await getAnimeDetails(malId);
  return {
    title: anime.title_english ?? anime.title,
    posterUrl: anime.images.jpg.large_image_url,
    backdropUrl: null,
    synopsis: anime.synopsis,
    genres: [...anime.genres, ...anime.themes].map((g) => g.name),
    releaseYear: anime.year,
    runtimeMinutes: null,
    episodeCount: anime.episodes,
  };
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();

  const body: unknown = await req.json();
  const parsed = importMediaSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input. Provide tmdbId or malId with type.", 400);
  }

  const { tmdbId, malId, type } = parsed.data;

  // Check for duplicate
  if (tmdbId !== undefined) {
    const existing = await db
      .selectFrom("media")
      .select("id")
      .where("tmdb_id", "=", tmdbId)
      .executeTakeFirst();
    if (existing) {
      return errorResponse("Media with this TMDB ID already exists", 409);
    }
  }
  if (malId !== undefined) {
    const existing = await db
      .selectFrom("media")
      .select("id")
      .where("mal_id", "=", malId)
      .executeTakeFirst();
    if (existing) {
      return errorResponse("Media with this MAL ID already exists", 409);
    }
  }

  // Fetch metadata from external API
  let metadata: MediaMetadata;
  if (type === "movie" && tmdbId !== undefined) {
    metadata = await fetchMovieMetadata(tmdbId);
  } else if (type === "tv" && tmdbId !== undefined) {
    metadata = await fetchTvMetadata(tmdbId);
  } else if (type === "anime" && malId !== undefined) {
    metadata = await fetchAnimeMetadata(malId);
  } else {
    return errorResponse("Invalid type/ID combination", 400);
  }

  const media = await db
    .insertInto("media")
    .values({
      title: metadata.title,
      type,
      tmdb_id: tmdbId ?? null,
      mal_id: malId ?? null,
      poster_url: metadata.posterUrl,
      backdrop_url: metadata.backdropUrl,
      synopsis: metadata.synopsis,
      genres: JSON.stringify(metadata.genres),
      release_year: metadata.releaseYear,
      runtime_minutes: metadata.runtimeMinutes,
      episode_count: metadata.episodeCount,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAudit({
    userId: user.id,
    action: "media.created",
    entityType: "media",
    entityId: media.id,
    metadata: { title: metadata.title, type, tmdbId, malId, source: "import" },
  });

  return successResponse(media, "Media imported", 201);
}
