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
import { collectSearchResults, type SearchSource } from "@/lib/media/search";
import { searchMediaSchema } from "@/lib/validations/media";
import type { MediaSearchResult } from "@/types/media";
import type { TmdbMovieSearchResult, TmdbTvSearchResult } from "@/types/tmdb";

/** TMDB Animation genre ID (same for movies and TV) */
const ANIMATION_GENRE_ID = 16;

function parseYear(dateString: string): number | null {
  return dateString.length > 0 ? Number(dateString.slice(0, 4)) : null;
}

function isPossibleAnimeMovie(movie: TmdbMovieSearchResult): boolean {
  return movie.genre_ids.includes(ANIMATION_GENRE_ID) && movie.original_language === "ja";
}

function isPossibleAnimeTv(show: TmdbTvSearchResult): boolean {
  return (
    show.genre_ids.includes(ANIMATION_GENRE_ID) &&
    (show.original_language === "ja" || show.origin_country.includes("JP"))
  );
}

function normalizeMovie(movie: TmdbMovieSearchResult): MediaSearchResult {
  const result: MediaSearchResult = {
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
  if (isPossibleAnimeMovie(movie)) {
    result.isPossibleAnime = true;
  }
  return result;
}

function normalizeTv(show: TmdbTvSearchResult): MediaSearchResult {
  const result: MediaSearchResult = {
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
  if (isPossibleAnimeTv(show)) {
    result.isPossibleAnime = true;
  }
  return result;
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

async function fetchMovies(query: string): Promise<MediaSearchResult[]> {
  const tmdbMovies = await searchMovies(query);
  return tmdbMovies.results.map((movie) => normalizeMovie(movie));
}

async function fetchTv(query: string): Promise<MediaSearchResult[]> {
  const tmdbTv = await searchTv(query);
  return tmdbTv.results.map((show) => normalizeTv(show));
}

async function fetchAnime(query: string): Promise<MediaSearchResult[]> {
  const jikanResults = await searchAnime(query);
  return jikanResults.data.map((anime) => ({
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
  }));
}

/**
 * Build the list of sources to query for this request. "All types" (no filter)
 * queries everything; a type filter narrows to a single source. Each source is
 * fault-isolated by collectSearchResults, so one flaky API (Jikan 504s often)
 * never fails the whole search.
 */
function buildSearchSources(query: string, type: string | undefined): SearchSource[] {
  const sources: SearchSource[] = [];

  if (type === "movie" || type === undefined) {
    sources.push({ key: "movie", run: () => fetchMovies(query) });
  }
  if (type === "tv" || type === undefined) {
    sources.push({ key: "tv", run: () => fetchTv(query) });
  }
  if (type === "anime" || type === undefined) {
    sources.push({ key: "anime", run: () => fetchAnime(query) });
  }

  return sources;
}

export async function GET(req: NextRequest) {
  await requireAuth();

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = searchMediaSchema.safeParse(params);
  if (!parsed.success) {
    return errorResponse("Invalid search parameters", 400);
  }

  const sources = buildSearchSources(parsed.data.query, parsed.data.type);
  const { results, failures } = await collectSearchResults(sources);
  await attachExistingMediaIds(results);

  // Log each failed source WITH its error so an operator can tell a transient
  // 504 from an auth/config failure or a code bug (which would otherwise hide
  // behind a perpetual "source unavailable" notice).
  for (const { key, error } of failures) {
    console.error(`[media/search] source "${key}" failed for query "${parsed.data.query}":`, error);
  }

  // Sort possible-anime TMDB results below Jikan anime results so users see
  // the proper anime version first when searching without a type filter.
  const sorted = results.toSorted((a, b) => {
    const aWeight = a.isPossibleAnime === true ? 1 : 0;
    const bWeight = b.isPossibleAnime === true ? 1 : 0;
    return aWeight - bWeight;
  });

  const failedSources = failures.map((failure) => failure.key);
  return successResponse({ results: sorted, failedSources });
}
