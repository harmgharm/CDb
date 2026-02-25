/**
 * TMDB API v3 Client
 *
 * Rate limit: ~40 req/sec (soft cap).
 * Auth: API key as query parameter.
 */

import { env } from "@/lib/env";
import type {
  TmdbMovieDetail,
  TmdbMovieSearchResult,
  TmdbSearchResponse,
  TmdbTvDetail,
  TmdbTvSearchResult,
} from "@/types/tmdb";

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

type ImageSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original";

export function tmdbImageUrl(path: string | null, size: ImageSize = "w500"): string | null {
  if (path === null) return null;
  return `${IMAGE_BASE_URL}/${size}${path}`;
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", env.TMDB_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status.toString()} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function searchMovies(
  query: string,
  page = 1,
): Promise<TmdbSearchResponse<TmdbMovieSearchResult>> {
  return tmdbFetch("/search/movie", {
    query,
    page: page.toString(),
    language: "en-US",
  });
}

export async function searchTv(
  query: string,
  page = 1,
): Promise<TmdbSearchResponse<TmdbTvSearchResult>> {
  return tmdbFetch("/search/tv", {
    query,
    page: page.toString(),
    language: "en-US",
  });
}

export async function getMovieDetails(tmdbId: number): Promise<TmdbMovieDetail> {
  return tmdbFetch(`/movie/${tmdbId.toString()}`, { language: "en-US" });
}

export async function getTvDetails(tmdbId: number): Promise<TmdbTvDetail> {
  return tmdbFetch(`/tv/${tmdbId.toString()}`, { language: "en-US" });
}
