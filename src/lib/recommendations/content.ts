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
import { addScoreJitter, chance, randomPage, randomSample, weightedShuffle } from "./random";
import type { RecommendationItem, WatchedIds } from "./types";
import { sliceWithTypeDepth } from "./types";
import {
  getUserWatchedAnimeTitles,
  getUserWatchedIds,
  isAlreadyWatched,
  isWatchedAnimeTitle,
  mergeWatchedIds,
} from "./watched";

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

interface CastScore {
  actor: string;
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
    .select([
      "media.id",
      "media.genres",
      "media.directors",
      "media.top_cast",
      "media.type",
      "ratings.score",
    ])
    .where("ratings.user_id", "=", userId)
    .execute();

  if (ratedMedia.length < 5) return [];

  // 2. Compute genre and director scores
  const genreScores = computeGenreScores(ratedMedia);
  const directorScores = computeDirectorScores(ratedMedia);
  const castScores = computeCastScores(ratedMedia);

  // Rotating genre seeds — a weighted sample instead of a fixed top slice, so
  // consecutive refreshes explore different corners of the user's taste.
  const topGenres = pickGenreSeeds(genreScores);

  const topDirectors = directorScores
    .filter((d) => d.avgRating >= 7.5)
    .toSorted((a, b) => b.avgRating - a.avgRating)
    .slice(0, 3);

  const topCast = castScores
    .filter((c) => c.avgRating >= 7.5 && c.count >= 2)
    .toSorted((a, b) => b.avgRating - a.avgRating)
    .slice(0, 5);

  // 3. Get watched IDs for exclusion
  const [watchedIds, dismissedIds, animeTitles] = await Promise.all([
    getUserWatchedIds(userId),
    getUserDismissedIds(userId),
    getUserWatchedAnimeTitles(userId),
  ]);
  const watched = mergeWatchedIds(watchedIds, dismissedIds);
  const results: RecommendationItem[] = [];

  // 4. Genre-based TMDB discover (max 3 API calls)
  const genreResults = await fetchGenreBasedResults(topGenres, watched, animeTitles);
  results.push(...genreResults);

  // 5. Director-based DB scan (zero API calls)
  const directorResults = await fetchDirectorBasedResults(topDirectors, watched, userId);
  results.push(...directorResults);

  // 6. Cast-based DB scan (zero API calls)
  const castResults = await fetchCastBasedResults(topCast, watched, userId);
  results.push(...castResults);

  // 7. Deduplicate and ensure each media type has up to 20 items for type filtering
  return deduplicateAndSlice(results, limit);
}

/** Seed-pool size: loved genres eligible for a compute's discover queries. */
const GENRE_SEED_POOL = 8;
/** Seeds actually queried per compute (up to 3 verticals each). */
const GENRE_SEED_COUNT = 4;

/**
 * Pick this compute's genre seeds: of the user's top 8 loved genres (avg >= 7)
 * that map to at least one discover vertical, take a rating-weighted sample
 * of 4. Rotating the seeds is what makes a section refresh surface different
 * titles rather than re-rolling the same discover queries; skipping
 * unqueryable niche tags (e.g. "Vampire") keeps seed slots from being wasted
 * on genres no API can be asked about.
 */
export function pickGenreSeeds(genreScores: GenreScore[]): GenreScore[] {
  const pool = genreScores
    .filter((g) => g.avgRating >= 7)
    .filter(
      (g) =>
        getMovieGenreId(g.genre) !== null ||
        getTvGenreId(g.genre) !== null ||
        getMalGenreId(g.genre) !== null,
    )
    .toSorted((a, b) => b.avgRating - a.avgRating)
    .slice(0, GENRE_SEED_POOL);

  return weightedShuffle(pool, (g) => g.avgRating).slice(0, GENRE_SEED_COUNT);
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

function computeCastScores(
  ratedMedia: {
    top_cast: { name: string }[] | null;
    score: string;
  }[],
): CastScore[] {
  const castMap = new Map<string, { total: number; count: number }>();

  for (const item of ratedMedia) {
    if (item.top_cast === null) continue;
    const score = Number(item.score);
    for (const member of item.top_cast) {
      const existing = castMap.get(member.name) ?? { total: 0, count: 0 };
      existing.total += score;
      existing.count += 1;
      castMap.set(member.name, existing);
    }
  }

  return [...castMap.entries()].map(([actor, data]) => ({
    actor,
    avgRating: Math.round((data.total / data.count) * 10) / 10,
    count: data.count,
  }));
}

async function fetchGenreBasedResults(
  topGenres: GenreScore[],
  watched: WatchedIds,
  animeTitles: Set<string>,
): Promise<RecommendationItem[]> {
  const movieResults: RecommendationItem[] = [];
  const tvResults: RecommendationItem[] = [];
  const animeResults: RecommendationItem[] = [];

  for (const genreScore of topGenres) {
    const movies = await fetchMovieGenreResults(genreScore, watched, animeTitles);
    movieResults.push(...movies);

    const tv = await fetchTvGenreResults(genreScore, watched, animeTitles);
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

/**
 * Discover ordering for this query: usually TMDB's top-rated list, but ~30% of
 * queries sort by popularity (with a rating floor so the tail stays watchable).
 * The two orderings surface very different titles — top-rated skews classics,
 * popularity skews current — which keeps refreshes from re-walking one list.
 */
function pickDiscoverSort(): Record<string, string> {
  return chance(0.3)
    ? { sort_by: "popularity.desc", "vote_average.gte": "6.8", "vote_count.gte": "300" }
    : { sort_by: "vote_average.desc", "vote_count.gte": "100" };
}

/** Per-genre keep cap for discover results. */
const MAX_PER_GENRE = 20;
/** Random start-page window for TMDB genre discovers. */
const DISCOVER_PAGE_WINDOW = 8;

async function fetchMovieGenreResults(
  genreScore: GenreScore,
  watched: WatchedIds,
  animeTitles: Set<string>,
): Promise<RecommendationItem[]> {
  const movieGenreId = getMovieGenreId(genreScore.genre);
  if (movieGenreId === null) return [];

  const results: RecommendationItem[] = [];
  const maxPerGenre = MAX_PER_GENRE;
  const startPage = Number(randomPage(DISCOVER_PAGE_WINDOW));
  // One sort per genre walk, so the 3 pages paginate a single consistent list.
  const sortParams = pickDiscoverSort();

  // Fetch up to 3 pages starting from a random page for variety
  for (let offset = 0; offset < 3 && results.length < maxPerGenre; offset += 1) {
    try {
      const response = await discoverMovies({
        with_genres: movieGenreId.toString(),
        ...sortParams,
        page: String(startPage + offset),
      });

      if (response.results.length === 0) break;

      for (const item of response.results) {
        if (results.length >= maxPerGenre) break;
        const skip =
          isAlreadyWatched(watched, { tmdbId: item.id }) ||
          isWatchedAnimeTitle(item.title, animeTitles);
        if (skip) continue;
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
  animeTitles: Set<string>,
): Promise<RecommendationItem[]> {
  const tvGenreId = getTvGenreId(genreScore.genre);
  if (tvGenreId === null) return [];

  const results: RecommendationItem[] = [];
  const maxPerGenre = MAX_PER_GENRE;
  const startPage = Number(randomPage(DISCOVER_PAGE_WINDOW));
  const sortParams = pickDiscoverSort();

  // Fetch up to 3 pages starting from a random page for variety
  for (let offset = 0; offset < 3 && results.length < maxPerGenre; offset += 1) {
    try {
      const response = await discoverTv({
        with_genres: tvGenreId.toString(),
        ...sortParams,
        page: String(startPage + offset),
      });

      if (response.results.length === 0) break;

      for (const item of response.results) {
        if (results.length >= maxPerGenre) break;
        const skip =
          isAlreadyWatched(watched, { tmdbId: item.id }) ||
          isWatchedAnimeTitle(item.name, animeTitles);
        if (skip) continue;
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

  const maxPerGenre = MAX_PER_GENRE;

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

async function fetchCastBasedResults(
  topCast: CastScore[],
  watched: WatchedIds,
  userId: string,
): Promise<RecommendationItem[]> {
  if (topCast.length === 0) return [];

  const results: RecommendationItem[] = [];

  const attendedMediaIds = await db
    .selectFrom("session_attendees")
    .innerJoin("watch_sessions", "watch_sessions.id", "session_attendees.session_id")
    .select("watch_sessions.media_id")
    .where("session_attendees.user_id", "=", userId)
    .execute();

  const watchedMediaIds = new Set(attendedMediaIds.map((r) => r.media_id));

  for (const castScore of topCast) {
    const media = await db
      .selectFrom("media")
      .selectAll()
      .where(
        sql<boolean>`EXISTS (SELECT 1 FROM jsonb_array_elements(media.top_cast) AS c WHERE c->>'name' = ${castScore.actor})`,
      )
      .execute();

    for (const item of media) {
      if (watchedMediaIds.has(item.id)) continue;
      if (isAlreadyWatched(watched, { mediaId: item.id })) continue;

      const castMatchScore = castScore.avgRating / 10;
      const voteScore = (item.tmdb_rating ?? item.mal_score ?? 0) / 10;
      const combinedScore = 0.5 * castMatchScore + 0.5 * voteScore;

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
            tag: "Featured cast",
            detail: `Features ${castScore.actor} (${String(castScore.avgRating)} avg)`,
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
