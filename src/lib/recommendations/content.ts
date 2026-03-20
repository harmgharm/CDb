/**
 * Content-Based Filtering
 *
 * Recommends media based on genres and directors the user rates highly.
 * Uses a combination of:
 * 1. TMDB discover API for genre-based external suggestions
 * 2. DB scan for director-based matches from already-imported media
 */

import { sql } from "kysely";

import { discoverAnime } from "@/lib/api/jikan";
import { getMalGenreId } from "@/lib/api/jikan-genres";
import { discoverMovies, discoverTv, tmdbImageUrl } from "@/lib/api/tmdb";
import {
  getMovieGenreId,
  getTvGenreId,
  mapMovieGenreIds,
  mapTvGenreIds,
} from "@/lib/api/tmdb-genres";
import { db } from "@/lib/db";
import type { TmdbMovieSearchResult, TmdbTvSearchResult } from "@/types/tmdb";

import { getUserDismissedIds } from "./dismissed";
import { addScoreJitter, randomPage, randomSample } from "./random";
import type { RecommendationItem, WatchedIds } from "./types";
import { sliceWithTypeDepth } from "./types";
import { getUserWatchedIds, isAlreadyWatched, mergeWatchedIds } from "./watched";

type ParsedMediaItem = Omit<RecommendationItem, "score" | "recType" | "reasons">;

interface GenreScore {
  genre: string;
  avgRating: number;
  count: number;
}

interface DirectorScore {
  director: string;
  avgRating: number;
  count: number;
}

/**
 * Compute content-based recommendations for a user.
 * Requires the user to have at least 5 ratings for meaningful results.
 */
export async function computeContentRecommendations(
  userId: string,
  limit = 60,
): Promise<RecommendationItem[]> {
  // 1. Get user's rated media with genres, directors, and scores
  const ratedMedia = await db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .innerJoin("media", "media.id", "watch_sessions.media_id")
    .select(["media.id", "media.genres", "media.directors", "media.type", "ratings.score"])
    .where("ratings.user_id", "=", userId)
    .execute();

  if (ratedMedia.length < 5) return [];

  // 2. Compute genre and director scores
  const genreScores = computeGenreScores(ratedMedia);
  const directorScores = computeDirectorScores(ratedMedia);

  // Top genres (avg >= 7.0) — widened to 5 to avoid genre lock-in
  const topGenres = genreScores
    .filter((g) => g.avgRating >= 7)
    .toSorted((a, b) => b.avgRating - a.avgRating)
    .slice(0, 5);

  const topDirectors = directorScores
    .filter((d) => d.avgRating >= 7.5)
    .toSorted((a, b) => b.avgRating - a.avgRating)
    .slice(0, 3);

  // 3. Get watched IDs for exclusion
  const watched = mergeWatchedIds(
    await getUserWatchedIds(userId),
    await getUserDismissedIds(userId),
  );
  const results: RecommendationItem[] = [];

  // 4. Genre-based TMDB discover (max 3 API calls)
  const genreResults = await fetchGenreBasedResults(topGenres, watched);
  results.push(...genreResults);

  // 5. Director-based DB scan (zero API calls)
  const directorResults = await fetchDirectorBasedResults(topDirectors, watched, userId);
  results.push(...directorResults);

  // 6. Deduplicate and ensure each media type has up to 20 items for type filtering
  return deduplicateAndSlice(results, limit);
}

function computeGenreScores(
  ratedMedia: {
    genres: string[];
    score: string;
  }[],
): GenreScore[] {
  const genreMap = new Map<string, { total: number; count: number }>();

  for (const item of ratedMedia) {
    const score = Number(item.score);
    for (const genre of item.genres) {
      const existing = genreMap.get(genre) ?? { total: 0, count: 0 };
      existing.total += score;
      existing.count += 1;
      genreMap.set(genre, existing);
    }
  }

  return [...genreMap.entries()].map(([genre, data]) => ({
    genre,
    avgRating: Math.round((data.total / data.count) * 10) / 10,
    count: data.count,
  }));
}

function computeDirectorScores(
  ratedMedia: {
    directors: string[] | null;
    score: string;
  }[],
): DirectorScore[] {
  const directorMap = new Map<string, { total: number; count: number }>();

  for (const item of ratedMedia) {
    if (item.directors === null) continue;
    const score = Number(item.score);
    for (const director of item.directors) {
      const existing = directorMap.get(director) ?? { total: 0, count: 0 };
      existing.total += score;
      existing.count += 1;
      directorMap.set(director, existing);
    }
  }

  return [...directorMap.entries()].map(([director, data]) => ({
    director,
    avgRating: Math.round((data.total / data.count) * 10) / 10,
    count: data.count,
  }));
}

async function fetchGenreBasedResults(
  topGenres: GenreScore[],
  watched: WatchedIds,
): Promise<RecommendationItem[]> {
  const movieResults: RecommendationItem[] = [];
  const tvResults: RecommendationItem[] = [];
  const animeResults: RecommendationItem[] = [];

  for (const genreScore of topGenres) {
    const movies = await fetchMovieGenreResults(genreScore, watched);
    movieResults.push(...movies);

    const tv = await fetchTvGenreResults(genreScore, watched);
    tvResults.push(...tv);

    const anime = await fetchAnimeGenreResultsForGenre(genreScore, watched);
    animeResults.push(...anime);
  }

  return [
    ...movieResults.toSorted((a, b) => b.score - a.score),
    ...tvResults.toSorted((a, b) => b.score - a.score),
    ...animeResults.toSorted((a, b) => b.score - a.score),
  ];
}

async function fetchMovieGenreResults(
  genreScore: GenreScore,
  watched: WatchedIds,
): Promise<RecommendationItem[]> {
  const movieGenreId = getMovieGenreId(genreScore.genre);
  if (movieGenreId === null) return [];

  const results: RecommendationItem[] = [];
  const maxPerGenre = 12;
  const startPage = Number(randomPage(5));

  // Fetch up to 3 pages starting from a random page for variety
  for (let offset = 0; offset < 3 && results.length < maxPerGenre; offset += 1) {
    try {
      const response = await discoverMovies({
        with_genres: movieGenreId.toString(),
        sort_by: "vote_average.desc",
        "vote_count.gte": "100",
        page: String(startPage + offset),
      });

      if (response.results.length === 0) break;

      for (const item of response.results) {
        if (results.length >= maxPerGenre) break;
        if (isAlreadyWatched(watched, { tmdbId: item.id })) continue;
        results.push(scoreGenreResult(parseMovieResult(item), genreScore));
      }
    } catch {
      break;
    }
  }

  return results;
}

async function fetchTvGenreResults(
  genreScore: GenreScore,
  watched: WatchedIds,
): Promise<RecommendationItem[]> {
  const tvGenreId = getTvGenreId(genreScore.genre);
  if (tvGenreId === null) return [];

  const results: RecommendationItem[] = [];
  const maxPerGenre = 12;
  const startPage = Number(randomPage(5));

  // Fetch up to 3 pages starting from a random page for variety
  for (let offset = 0; offset < 3 && results.length < maxPerGenre; offset += 1) {
    try {
      const response = await discoverTv({
        with_genres: tvGenreId.toString(),
        sort_by: "vote_average.desc",
        "vote_count.gte": "100",
        page: String(startPage + offset),
      });

      if (response.results.length === 0) break;

      for (const item of response.results) {
        if (results.length >= maxPerGenre) break;
        if (isAlreadyWatched(watched, { tmdbId: item.id })) continue;
        results.push(scoreGenreResult(parseTvResult(item), genreScore));
      }
    } catch {
      break;
    }
  }

  return results;
}

async function fetchAnimeGenreResultsForGenre(
  genreScore: GenreScore,
  watched: WatchedIds,
): Promise<RecommendationItem[]> {
  const malGenreId = getMalGenreId(genreScore.genre);
  if (malGenreId === null) return [];

  const maxPerGenre = 12;

  try {
    const response = await discoverAnime({
      genres: malGenreId.toString(),
      order_by: "score",
      sort: "desc",
      min_score: "7",
      page: randomPage(3),
    });

    const results: RecommendationItem[] = [];
    for (const anime of response.data) {
      if (results.length >= maxPerGenre) break;
      if (isAlreadyWatched(watched, { malId: anime.mal_id })) continue;

      results.push(
        scoreGenreResult(
          {
            mediaId: null,
            tmdbId: null,
            malId: anime.mal_id,
            title: anime.title_english ?? anime.title,
            posterUrl: anime.images.jpg.large_image_url,
            mediaType: "anime" as const,
            overview: anime.synopsis,
            releaseYear: anime.year,
            voteAverage: anime.score,
            genres: anime.genres.map((g) => g.name),
          },
          genreScore,
        ),
      );
    }
    return results;
  } catch {
    return [];
  }
}

function scoreGenreResult(parsed: ParsedMediaItem, genreScore: GenreScore): RecommendationItem {
  const genreMatchScore = genreScore.avgRating / 10;
  const voteScore = (parsed.voteAverage ?? 0) / 10;
  const combinedScore = 0.6 * genreMatchScore + 0.4 * voteScore;

  return {
    ...parsed,
    score: Math.round(combinedScore * 1000) / 1000,
    recType: "content",
    reasons: [
      {
        tag: "Top genre",
        detail: `You rated ${genreScore.genre} ${String(genreScore.avgRating)} avg`,
      },
    ],
  };
}

async function fetchDirectorBasedResults(
  topDirectors: DirectorScore[],
  watched: WatchedIds,
  userId: string,
): Promise<RecommendationItem[]> {
  if (topDirectors.length === 0) return [];

  const results: RecommendationItem[] = [];

  // Get all user's attended session media IDs
  const attendedMediaIds = await db
    .selectFrom("session_attendees")
    .innerJoin("watch_sessions", "watch_sessions.id", "session_attendees.session_id")
    .select("watch_sessions.media_id")
    .where("session_attendees.user_id", "=", userId)
    .execute();

  const watchedMediaIds = new Set(attendedMediaIds.map((r) => r.media_id));

  // For each top director, find matching unwatched media via jsonb containment
  for (const directorScore of topDirectors) {
    const media = await db
      .selectFrom("media")
      .selectAll()
      .where(sql<boolean>`media.directors @> ${JSON.stringify([directorScore.director])}::jsonb`)
      .execute();

    for (const item of media) {
      if (watchedMediaIds.has(item.id)) continue;
      if (isAlreadyWatched(watched, { mediaId: item.id })) continue;

      const directorMatchScore = directorScore.avgRating / 10;
      const voteScore = (item.tmdb_rating ?? item.mal_score ?? 0) / 10;
      const combinedScore = 0.5 * directorMatchScore + 0.5 * voteScore;

      results.push({
        mediaId: item.id,
        tmdbId: item.tmdb_id,
        malId: item.mal_id,
        title: item.title,
        posterUrl: item.poster_url,
        mediaType: item.type,
        overview: item.synopsis,
        releaseYear: item.release_year,
        voteAverage: item.tmdb_rating ?? item.mal_score,
        genres: item.genres,
        score: Math.round(combinedScore * 1000) / 1000,
        recType: "content",
        reasons: [
          {
            tag: "Top director",
            detail: `You rated ${directorScore.director} films ${String(directorScore.avgRating)} avg`,
          },
        ],
      });
    }
  }

  return results;
}

function parseMovieResult(item: TmdbMovieSearchResult): ParsedMediaItem {
  return {
    mediaId: null,
    tmdbId: item.id,
    malId: null,
    title: item.title,
    posterUrl: tmdbImageUrl(item.poster_path),
    mediaType: "movie",
    overview: item.overview,
    releaseYear: item.release_date.length > 0 ? Number(item.release_date.slice(0, 4)) : null,
    voteAverage: item.vote_average,
    genres: mapMovieGenreIds(item.genre_ids),
  };
}

function parseTvResult(item: TmdbTvSearchResult): ParsedMediaItem {
  return {
    mediaId: null,
    tmdbId: item.id,
    malId: null,
    title: item.name,
    posterUrl: tmdbImageUrl(item.poster_path),
    mediaType: "tv",
    overview: item.overview,
    releaseYear: item.first_air_date.length > 0 ? Number(item.first_air_date.slice(0, 4)) : null,
    voteAverage: item.vote_average,
    genres: mapTvGenreIds(item.genre_ids),
  };
}

/** Deduplicate, apply jitter, random-sample from oversized pool, then type-depth slice */
function deduplicateAndSlice(items: RecommendationItem[], limit: number): RecommendationItem[] {
  const seen = new Set<string>();
  const unique: RecommendationItem[] = [];

  for (const item of items) {
    const key =
      item.mediaId ??
      (item.tmdbId === null ? `mal-${String(item.malId)}` : `tmdb-${String(item.tmdbId)}`);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  // Add score jitter for ordering variety, then sample from the larger pool
  const jittered = addScoreJitter(unique);
  const poolSize = Math.min(jittered.length, Math.max(limit, 100));
  const pool = randomSample(jittered, poolSize);

  return sliceWithTypeDepth(pool, limit);
}
