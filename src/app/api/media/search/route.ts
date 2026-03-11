/**
 * GET /api/media/search
 *
 * Unified media search across TMDB (movies/TV) and Jikan (anime).
 */

import type { NextRequest } from "next/server";

import { searchAnime } from "@/lib/api/jikan";
import { errorResponse, successResponse } from "@/lib/api/response";
import { searchMovies, searchTv, tmdbImageUrl } from "@/lib/api/tmdb";
import { mapMovieGenreIds, mapTvGenreIds } from "@/lib/api/tmdb-genres";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { searchMediaSchema } from "@/lib/validations/media";
import type { MediaSearchResult } from "@/types/media";
import type { TmdbMovieSearchResult, TmdbTvSearchResult } from "@/types/tmdb";

function parseYear(dateString: string): number | null {
  return dateString.length > 0 ? Number(dateString.slice(0, 4)) : null;
}

function normalizeMovie(movie: TmdbMovieSearchResult): MediaSearchResult {
  return {
    externalId: movie.id,
    title: movie.title,
    type: "movie",
    posterUrl: tmdbImageUrl(movie.poster_path),
    releaseYear: parseYear(movie.release_date),
    overview: movie.overview.length > 0 ? movie.overview : null,
    source: "tmdb",
    voteAverage: movie.vote_average > 0 ? movie.vote_average : null,
    genres: mapMovieGenreIds(movie.genre_ids),
  };
}

function normalizeTv(show: TmdbTvSearchResult): MediaSearchResult {
  return {
    externalId: show.id,
    title: show.name,
    type: "tv",
    posterUrl: tmdbImageUrl(show.poster_path),
    releaseYear: parseYear(show.first_air_date),
    overview: show.overview.length > 0 ? show.overview : null,
    source: "tmdb",
    voteAverage: show.vote_average > 0 ? show.vote_average : null,
    genres: mapTvGenreIds(show.genre_ids),
  };
}

async function lookupExistingIds(
  column: "tmdb_id" | "mal_id",
  ids: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (ids.length === 0) return map;

  const rows = await db
    .selectFrom("media")
    .select(["id", column])
    .where(column, "in", ids)
    .execute();

  for (const row of rows) {
    const externalId = row[column];
    if (externalId !== null) map.set(externalId, row.id);
  }

  return map;
}

/**
 * Cross-reference search results against the database to mark already-imported media.
 * Uses batch WHERE IN queries for efficiency (one for TMDB IDs, one for MAL IDs).
 */
async function attachExistingMediaIds(results: MediaSearchResult[]): Promise<void> {
  const tmdbIds = results.filter((r) => r.source === "tmdb").map((r) => r.externalId);
  const malIds = results.filter((r) => r.source === "jikan").map((r) => r.externalId);

  const [existingByTmdb, existingByMal] = await Promise.all([
    lookupExistingIds("tmdb_id", tmdbIds),
    lookupExistingIds("mal_id", malIds),
  ]);

  for (const result of results) {
    const lookup = result.source === "tmdb" ? existingByTmdb : existingByMal;
    const existingId = lookup.get(result.externalId);
    if (existingId !== undefined) {
      result.existingMediaId = existingId;
    }
  }
}

async function fetchSearchResults(
  query: string,
  type: string | undefined,
): Promise<MediaSearchResult[]> {
  const results: MediaSearchResult[] = [];

  if (type === "movie" || type === undefined) {
    const tmdbMovies = await searchMovies(query);
    results.push(...tmdbMovies.results.map((movie) => normalizeMovie(movie)));
  }

  if (type === "tv" || type === undefined) {
    const tmdbTv = await searchTv(query);
    results.push(...tmdbTv.results.map((show) => normalizeTv(show)));
  }

  if (type === "anime" || type === undefined) {
    const jikanResults = await searchAnime(query);
    for (const anime of jikanResults.data) {
      results.push({
        externalId: anime.mal_id,
        title: anime.title_english ?? anime.title,
        type: "anime",
        posterUrl: anime.images.jpg.large_image_url,
        releaseYear: anime.year,
        overview: anime.synopsis,
        source: "jikan",
        voteAverage: anime.score,
        genres: anime.genres.map((g) => g.name),
        episodeCount: anime.episodes,
        studios: anime.studios.map((s) => s.name),
      });
    }
  }

  return results;
}

export async function GET(req: NextRequest) {
  await requireAuth();

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = searchMediaSchema.safeParse(params);
  if (!parsed.success) {
    return errorResponse("Invalid search parameters", 400);
  }

  const results = await fetchSearchResults(parsed.data.query, parsed.data.type);
  await attachExistingMediaIds(results);

  return successResponse(results);
}
