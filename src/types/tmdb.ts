/**
 * TMDB API v3 response types
 */

export interface TmdbSearchResponse<T> {
  page: number;
  total_pages: number;
  total_results: number;
  results: T[];
}

export interface TmdbMovieSearchResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids: number[];
  release_date: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
  adult: boolean;
}

export interface TmdbTvSearchResult {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids: number[];
  first_air_date: string;
  origin_country: string[];
  popularity: number;
  vote_average: number;
  vote_count: number;
}

export interface TmdbMovieDetail {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: TmdbGenre[];
  release_date: string;
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  status: string;
  tagline: string;
  imdb_id: string | null;
  budget: number;
  revenue: number;
  production_companies: TmdbProductionCompany[];
  videos?: TmdbVideosResponse;
  release_dates?: TmdbReleaseDatesResponse;
}

export interface TmdbTvCreator {
  id: number;
  name: string;
  credit_id: string;
  profile_path: string | null;
}

export interface TmdbTvDetail {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: TmdbGenre[];
  first_air_date: string;
  number_of_episodes: number;
  number_of_seasons: number;
  episode_run_time: number[];
  vote_average: number;
  vote_count: number;
  status: string;
  tagline: string;
  origin_country: string[];
  networks: TmdbNetwork[];
  production_companies: TmdbProductionCompany[];
  created_by: TmdbTvCreator[];
  videos?: TmdbVideosResponse;
  content_ratings?: TmdbContentRatingsResponse;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

/** Crew member from /movie/{id}/credits or /tv/{id}/credits */
export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
}

/** Response from /movie/{id}/credits */
export interface TmdbCreditsResponse {
  id: number;
  crew: TmdbCrewMember[];
}

/** Response from /tv/{id}/external_ids */
export interface TmdbExternalIds {
  imdb_id: string | null;
  tvdb_id: number | null;
}

/** Single video from /movie/{id}/videos or /tv/{id}/videos */
export interface TmdbVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

/** Response shape for videos (standalone or via append_to_response) */
export interface TmdbVideosResponse {
  results: TmdbVideo[];
}

/** Production company from movie/TV detail */
export interface TmdbProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

/** Network from TV detail */
export interface TmdbNetwork {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

/** Single release date entry from /movie/{id}/release_dates */
export interface TmdbReleaseDateEntry {
  certification: string;
  type: number;
}

/** Country-level release dates result */
export interface TmdbReleaseDatesResult {
  iso_3166_1: string;
  release_dates: TmdbReleaseDateEntry[];
}

/** Response from append_to_response=release_dates */
export interface TmdbReleaseDatesResponse {
  results: TmdbReleaseDatesResult[];
}

/** Single content rating result from /tv/{id}/content_ratings */
export interface TmdbContentRatingResult {
  iso_3166_1: string;
  rating: string;
}

/** Response from append_to_response=content_ratings */
export interface TmdbContentRatingsResponse {
  results: TmdbContentRatingResult[];
}
