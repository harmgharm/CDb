/**
 * Shared media metadata extraction from TMDB and Jikan APIs.
 *
 * Used by both the import route (new entries) and refresh routes (updating existing entries).
 */

import { getAnimeDetails } from "@/lib/api/jikan";
import {
  findTrailerKey,
  findUsCertification,
  findUsContentRating,
  getMovieCredits,
  getMovieDetails,
  getTvDetails,
  getTvExternalIds,
  tmdbImageUrl,
} from "@/lib/api/tmdb";

export interface MediaMetadata {
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  synopsis: string | null;
  genres: string[];
  releaseYear: number | null;
  runtimeMinutes: number | null;
  episodeCount: number | null;
  directors: string[] | null;
  imdbId: string | null;
  tmdbRating: number | null;
  malScore: number | null;
  status: string | null;
  originalTitle: string | null;
  tagline: string | null;
  voteCount: number | null;
  seasonCount: number | null;
  trailerKey: string | null;
  originCountry: string[] | null;
  certification: string | null;
  networks: string[] | null;
  budget: number | null;
  revenue: number | null;
  studios: string[] | null;
}

function parseYear(dateString: string): number | null {
  return dateString.length > 0 ? Number(dateString.slice(0, 4)) : null;
}

function parseAnimeRating(rating: string | null): string | null {
  if (rating === null) return null;
  const dashIndex = rating.indexOf(" - ");
  return dashIndex > 0 ? rating.slice(0, dashIndex) : rating;
}

function extractYoutubeKey(embedUrl: string | null): string | null {
  if (embedUrl === null) return null;
  const match = /\/embed\/([a-zA-Z0-9_-]+)/.exec(embedUrl);
  return match?.[1] ?? null;
}

export async function fetchMovieMetadata(tmdbId: number): Promise<MediaMetadata> {
  const [movie, credits] = await Promise.all([getMovieDetails(tmdbId), getMovieCredits(tmdbId)]);

  const directors = credits.crew
    .filter((member) => member.job === "Director")
    .map((member) => member.name);

  return {
    title: movie.title,
    posterUrl: tmdbImageUrl(movie.poster_path),
    backdropUrl: tmdbImageUrl(movie.backdrop_path, "w780"),
    synopsis: movie.overview.length > 0 ? movie.overview : null,
    genres: movie.genres.map((g) => g.name),
    releaseYear: parseYear(movie.release_date),
    runtimeMinutes: movie.runtime,
    episodeCount: null,
    directors: directors.length > 0 ? directors : null,
    imdbId: movie.imdb_id,
    tmdbRating: movie.vote_average > 0 ? movie.vote_average : null,
    malScore: null,
    status: movie.status,
    originalTitle: movie.original_title === movie.title ? null : movie.original_title,
    tagline: movie.tagline.length > 0 ? movie.tagline : null,
    voteCount: movie.vote_count > 0 ? movie.vote_count : null,
    seasonCount: null,
    trailerKey: findTrailerKey(movie.videos?.results ?? []),
    originCountry: null,
    certification: findUsCertification(movie.release_dates ?? { results: [] }),
    networks: null,
    budget: movie.budget > 0 ? movie.budget : null,
    revenue: movie.revenue > 0 ? movie.revenue : null,
    studios:
      movie.production_companies.length > 0 ? movie.production_companies.map((c) => c.name) : null,
  };
}

export async function fetchTvMetadata(tmdbId: number): Promise<MediaMetadata> {
  const [show, externalIds] = await Promise.all([getTvDetails(tmdbId), getTvExternalIds(tmdbId)]);

  const creators = show.created_by.map((c) => c.name);

  return {
    title: show.name,
    posterUrl: tmdbImageUrl(show.poster_path),
    backdropUrl: tmdbImageUrl(show.backdrop_path, "w780"),
    synopsis: show.overview.length > 0 ? show.overview : null,
    genres: show.genres.map((g) => g.name),
    releaseYear: parseYear(show.first_air_date),
    runtimeMinutes: show.episode_run_time[0] ?? null,
    episodeCount: show.number_of_episodes,
    directors: creators.length > 0 ? creators : null,
    imdbId: externalIds.imdb_id,
    tmdbRating: show.vote_average > 0 ? show.vote_average : null,
    malScore: null,
    status: show.status,
    originalTitle: show.original_name === show.name ? null : show.original_name,
    tagline: show.tagline.length > 0 ? show.tagline : null,
    voteCount: show.vote_count > 0 ? show.vote_count : null,
    seasonCount: show.number_of_seasons > 0 ? show.number_of_seasons : null,
    trailerKey: findTrailerKey(show.videos?.results ?? []),
    originCountry: show.origin_country.length > 0 ? show.origin_country : null,
    certification: findUsContentRating(show.content_ratings ?? { results: [] }),
    networks: show.networks.length > 0 ? show.networks.map((n) => n.name) : null,
    budget: null,
    revenue: null,
    studios:
      show.production_companies.length > 0 ? show.production_companies.map((c) => c.name) : null,
  };
}

export async function fetchAnimeMetadata(malId: number): Promise<MediaMetadata> {
  const { data: anime } = await getAnimeDetails(malId);
  const displayTitle = anime.title_english ?? anime.title;
  return {
    title: displayTitle,
    posterUrl: anime.images.jpg.large_image_url,
    backdropUrl: null,
    synopsis: anime.synopsis,
    genres: [...anime.genres, ...anime.themes, ...anime.demographics].map((g) => g.name),
    releaseYear: anime.year,
    runtimeMinutes: null,
    episodeCount: anime.episodes,
    directors: null,
    imdbId: null,
    tmdbRating: null,
    malScore: anime.score,
    status: anime.status,
    originalTitle: anime.title === displayTitle ? null : anime.title,
    tagline: null,
    voteCount: anime.scored_by,
    seasonCount: null,
    trailerKey: extractYoutubeKey(anime.trailer.embed_url),
    originCountry: null,
    certification: parseAnimeRating(anime.rating),
    networks: null,
    budget: null,
    revenue: null,
    studios: anime.studios.length > 0 ? anime.studios.map((s) => s.name) : null,
  };
}

/** Convert MediaMetadata to a DB-ready update/insert values object */
export function metadataToDbFields(metadata: MediaMetadata): Record<string, unknown> {
  return {
    title: metadata.title,
    poster_url: metadata.posterUrl,
    backdrop_url: metadata.backdropUrl,
    synopsis: metadata.synopsis,
    genres: JSON.stringify(metadata.genres),
    release_year: metadata.releaseYear,
    runtime_minutes: metadata.runtimeMinutes,
    episode_count: metadata.episodeCount,
    directors: metadata.directors === null ? null : JSON.stringify(metadata.directors),
    imdb_id: metadata.imdbId,
    tmdb_rating: metadata.tmdbRating,
    mal_score: metadata.malScore,
    status: metadata.status,
    original_title: metadata.originalTitle,
    tagline: metadata.tagline,
    vote_count: metadata.voteCount,
    season_count: metadata.seasonCount,
    trailer_key: metadata.trailerKey,
    origin_country: metadata.originCountry === null ? null : JSON.stringify(metadata.originCountry),
    certification: metadata.certification,
    networks: metadata.networks === null ? null : JSON.stringify(metadata.networks),
    budget: metadata.budget,
    revenue: metadata.revenue,
    studios: metadata.studios === null ? null : JSON.stringify(metadata.studios),
  };
}
