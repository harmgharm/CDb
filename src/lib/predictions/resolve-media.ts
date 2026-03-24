/**
 * Media resolver for predictions.
 *
 * Resolves a prediction request to full metadata, checking the DB first
 * then falling back to external APIs (TMDB/Jikan).
 */

import { getAnimeDetails } from "@/lib/api/jikan";
import {
  findTrailerKey,
  getMovieCredits,
  getMovieDetails,
  getTvDetails,
  tmdbImageUrl,
} from "@/lib/api/tmdb";
import { db } from "@/lib/db";
import type { PredictionRequestInput } from "@/lib/validations/predictions";

import type { ResolvedMedia } from "./types";

function youtubeUrl(key: string | null): string | null {
  return key === null ? null : `https://www.youtube.com/watch?v=${key}`;
}

function extractYoutubeKey(embedUrl: string | null): string | null {
  if (embedUrl === null) return null;
  const match = /\/embed\/([a-zA-Z0-9_-]+)/.exec(embedUrl);
  return match?.[1] ?? null;
}

/**
 * Resolve media metadata from DB or external API.
 * Priority: mediaId → tmdb_id/mal_id in DB → TMDB/Jikan API.
 */
export async function resolveMedia(input: PredictionRequestInput): Promise<ResolvedMedia> {
  // 1. Try DB lookup
  const dbMedia = await findInDatabase(input);
  if (dbMedia !== null) return dbMedia;

  // 2. Fall back to external API
  if (input.mediaType === "anime" && input.malId !== undefined) {
    return resolveFromJikan(input.malId);
  }

  if (input.tmdbId !== undefined) {
    return resolveFromTmdb(input.tmdbId, input.mediaType);
  }

  throw new Error("Cannot resolve media: no valid identifier provided");
}

async function findInDatabase(input: PredictionRequestInput): Promise<ResolvedMedia | null> {
  let query = db
    .selectFrom("media")
    .select([
      "id",
      "title",
      "type",
      "tmdb_id",
      "mal_id",
      "poster_url",
      "synopsis",
      "genres",
      "directors",
      "release_year",
      "runtime_minutes",
      "episode_count",
      "tmdb_rating",
      "mal_score",
      "trailer_key",
    ]);

  if (input.mediaId !== undefined) {
    query = query.where("id", "=", input.mediaId);
  } else if (input.tmdbId !== undefined) {
    query = query.where("tmdb_id", "=", input.tmdbId);
  } else if (input.malId === undefined) {
    return null;
  } else {
    query = query.where("mal_id", "=", input.malId);
  }

  const row = await query.executeTakeFirst();
  if (row === undefined) return null;

  return {
    mediaId: row.id,
    tmdbId: row.tmdb_id,
    malId: row.mal_id,
    title: row.title,
    posterUrl: row.poster_url,
    mediaType: row.type,
    releaseYear: row.release_year,
    genres: row.genres,
    directors: row.directors ?? [],
    overview: row.synopsis,
    runtimeMinutes: row.runtime_minutes,
    episodeCount: row.episode_count,
    voteAverage: row.tmdb_rating ?? row.mal_score,
    trailerUrl: youtubeUrl(row.trailer_key),
  };
}

async function resolveFromTmdb(
  tmdbId: number,
  mediaType: "movie" | "tv" | "anime",
): Promise<ResolvedMedia> {
  if (mediaType === "movie") {
    const [details, credits] = await Promise.all([
      getMovieDetails(tmdbId),
      getMovieCredits(tmdbId),
    ]);

    const directors = credits.crew.filter((c) => c.job === "Director").map((c) => c.name);
    const trailerKey = details.videos ? findTrailerKey(details.videos.results) : null;

    return {
      mediaId: null,
      tmdbId,
      malId: null,
      title: details.title,
      posterUrl: tmdbImageUrl(details.poster_path),
      mediaType: "movie",
      releaseYear:
        details.release_date.length > 0 ? Number(details.release_date.slice(0, 4)) : null,
      genres: details.genres.map((g) => g.name),
      directors,
      overview: details.overview,
      runtimeMinutes: details.runtime,
      episodeCount: null,
      voteAverage: details.vote_average,
      trailerUrl: youtubeUrl(trailerKey),
    };
  }

  // TV or anime-on-TMDB
  const details = await getTvDetails(tmdbId);
  const creators = details.created_by.map((c) => c.name);
  const trailerKey = details.videos ? findTrailerKey(details.videos.results) : null;

  return {
    mediaId: null,
    tmdbId,
    malId: null,
    title: details.name,
    posterUrl: tmdbImageUrl(details.poster_path),
    mediaType: mediaType === "anime" ? "anime" : "tv",
    releaseYear:
      details.first_air_date.length > 0 ? Number(details.first_air_date.slice(0, 4)) : null,
    genres: details.genres.map((g) => g.name),
    directors: creators,
    overview: details.overview,
    runtimeMinutes:
      details.episode_run_time.length > 0 ? (details.episode_run_time[0] ?? null) : null,
    episodeCount: details.number_of_episodes,
    voteAverage: details.vote_average,
    trailerUrl: youtubeUrl(trailerKey),
  };
}

async function resolveFromJikan(malId: number): Promise<ResolvedMedia> {
  const { data: anime } = await getAnimeDetails(malId);
  const trailerKey = extractYoutubeKey(anime.trailer.embed_url) ?? anime.trailer.youtube_id;

  return {
    mediaId: null,
    tmdbId: null,
    malId,
    title: anime.title_english ?? anime.title,
    posterUrl: anime.images.jpg.large_image_url,
    mediaType: "anime",
    releaseYear: anime.year,
    genres: anime.genres.map((g) => g.name),
    directors: [],
    overview: anime.synopsis,
    runtimeMinutes: null,
    episodeCount: anime.episodes,
    voteAverage: anime.score,
    trailerUrl: youtubeUrl(trailerKey),
  };
}
