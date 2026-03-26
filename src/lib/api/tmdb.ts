/**
 * TMDB API v3 Client
 *
 * Rate limit: ~40 req/sec (soft cap).
 * Auth: API key as query parameter.
 */

import { env } from "@/lib/env";
import type {
  TmdbContentRatingsResponse,
  TmdbExternalIds,
  TmdbMovieDetail,
  TmdbMovieSearchResult,
  TmdbReleaseDatesResponse,
  TmdbSearchResponse,
  TmdbTvDetail,
  TmdbTvSearchResult,
  TmdbVideo,
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
  return tmdbFetch(`/movie/${tmdbId.toString()}`, {
    language: "en-US",
    append_to_response: "videos,release_dates,credits",
  });
}

export async function getTvDetails(tmdbId: number): Promise<TmdbTvDetail> {
  return tmdbFetch(`/tv/${tmdbId.toString()}`, {
    language: "en-US",
    append_to_response: "videos,content_ratings,credits",
  });
}

/**
 * Find the best YouTube trailer key from TMDB videos results.
 * Prefers official trailers, falls back to any trailer on YouTube.
 */
export function findTrailerKey(videos: TmdbVideo[]): string | null {
  const youtubeTrailers = videos.filter((v) => v.site === "YouTube" && v.type === "Trailer");
  const first = youtubeTrailers[0];
  if (first === undefined) return null;
  const official = youtubeTrailers.find((v) => v.official);
  return official?.key ?? first.key;
}

/**
 * Extract the US movie certification from release_dates (append_to_response).
 * Prefers theatrical release (type 3), falls back to any non-empty certification.
 */
export function findUsCertification(releaseDates: TmdbReleaseDatesResponse): string | null {
  const usEntry = releaseDates.results.find((r) => r.iso_3166_1 === "US");
  if (usEntry === undefined) return null;
  const theatrical = usEntry.release_dates.find(
    (rd) => rd.certification.length > 0 && rd.type === 3,
  );
  if (theatrical !== undefined) return theatrical.certification;
  const fallback = usEntry.release_dates.find((rd) => rd.certification.length > 0);
  return fallback?.certification ?? null;
}

/**
 * Extract the US TV content rating from content_ratings (append_to_response).
 */
export function findUsContentRating(contentRatings: TmdbContentRatingsResponse): string | null {
  const usEntry = contentRatings.results.find((r) => r.iso_3166_1 === "US");
  return usEntry?.rating ?? null;
}

export async function getTvExternalIds(tmdbId: number): Promise<TmdbExternalIds> {
  return tmdbFetch(`/tv/${tmdbId.toString()}/external_ids`);
}

export async function getMovieRecommendations(
  tmdbId: number,
  page = 1,
): Promise<TmdbSearchResponse<TmdbMovieSearchResult>> {
  return tmdbFetch(`/movie/${tmdbId.toString()}/recommendations`, {
    page: page.toString(),
    language: "en-US",
  });
}

export async function getTvRecommendations(
  tmdbId: number,
  page = 1,
): Promise<TmdbSearchResponse<TmdbTvSearchResult>> {
  return tmdbFetch(`/tv/${tmdbId.toString()}/recommendations`, {
    page: page.toString(),
    language: "en-US",
  });
}

export async function getMovieSimilar(
  tmdbId: number,
  page = 1,
): Promise<TmdbSearchResponse<TmdbMovieSearchResult>> {
  return tmdbFetch(`/movie/${tmdbId.toString()}/similar`, {
    page: page.toString(),
    language: "en-US",
  });
}

export async function getTvSimilar(
  tmdbId: number,
  page = 1,
): Promise<TmdbSearchResponse<TmdbTvSearchResult>> {
  return tmdbFetch(`/tv/${tmdbId.toString()}/similar`, {
    page: page.toString(),
    language: "en-US",
  });
}

export async function discoverMovies(
  params: Record<string, string>,
): Promise<TmdbSearchResponse<TmdbMovieSearchResult>> {
  return tmdbFetch("/discover/movie", { language: "en-US", ...params });
}

export async function discoverTv(
  params: Record<string, string>,
): Promise<TmdbSearchResponse<TmdbTvSearchResult>> {
  return tmdbFetch("/discover/tv", { language: "en-US", ...params });
}
