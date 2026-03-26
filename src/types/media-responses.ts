/**
 * Frontend types for media API responses
 */

import type { MediaType } from "@/lib/db/types";

/** Single media item from GET /api/media list */
export interface MediaListItem {
  id: string;
  title: string;
  type: MediaType;
  tmdb_id: number | null;
  mal_id: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  synopsis: string | null;
  genres: string[];
  release_year: number | null;
  episode_count: number | null;
  runtime_minutes: number | null;
  directors: string[] | null;
  imdb_id: string | null;
  tmdb_rating: number | null;
  mal_score: number | null;
  status: string | null;
  original_title: string | null;
  tagline: string | null;
  vote_count: number | null;
  season_count: number | null;
  trailer_key: string | null;
  origin_country: string[] | null;
  certification: string | null;
  networks: string[] | null;
  budget: string | null;
  revenue: string | null;
  studios: string[] | null;
  top_cast:
    | {
        id: number;
        name: string;
        character: string;
        profilePath: string | null;
      }[]
    | null;
  created_at: string;
  updated_at: string;
}

/** Paginated response from GET /api/media */
export interface MediaListResponse {
  items: MediaListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Attendee info from session */
export interface SessionAttendee {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

/** Session info from media detail */
export interface MediaSession {
  id: string;
  date_watched: string | null;
  time_watched_at: string | null;
  notes: string | null;
  created_at: string;
  created_by_user_id: string | null;
  picker_id: string | null;
  picker_username: string | null;
  picker_display_name: string | null;
  picker_avatar_url: string | null;
  attendees: SessionAttendee[];
}

/** Rating info from media detail */
export interface MediaRating {
  id: string;
  session_id: string;
  score: number;
  review: string | null;
  created_at: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

/** Full media detail from GET /api/media/[id] */
export interface MediaDetail extends MediaListItem {
  sessions: MediaSession[];
  ratings: MediaRating[];
  stats: {
    sessionCount: number;
    ratingCount: number;
    avgRating: number | null;
  };
}
