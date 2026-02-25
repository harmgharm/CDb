/**
 * GET /api/media/search
 *
 * Unified media search across TMDB (movies/TV) and Jikan (anime).
 */

import type { NextRequest } from "next/server";

import { searchAnime } from "@/lib/api/jikan";
import { errorResponse, successResponse } from "@/lib/api/response";
import { searchMovies, searchTv, tmdbImageUrl } from "@/lib/api/tmdb";
import { requireAuth } from "@/lib/auth";
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
  };
}

export async function GET(req: NextRequest) {
  await requireAuth();

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = searchMediaSchema.safeParse(params);
  if (!parsed.success) {
    return errorResponse("Invalid search parameters", 400);
  }

  const { query, type } = parsed.data;
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
      });
    }
  }

  return successResponse(results);
}
