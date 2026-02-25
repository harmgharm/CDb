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
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: TmdbGenre[];
  release_date: string;
  runtime: number | null;
  vote_average: number;
  status: string;
}

export interface TmdbTvDetail {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: TmdbGenre[];
  first_air_date: string;
  number_of_episodes: number;
  episode_run_time: number[];
  vote_average: number;
  status: string;
}

export interface TmdbGenre {
  id: number;
  name: string;
}
