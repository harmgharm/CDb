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

/** Session info from media detail */
export interface MediaSession {
  id: string;
  date_watched: string;
  time_watched_at: string | null;
  notes: string | null;
  created_at: string;
  picker_id: string;
  picker_username: string;
  picker_display_name: string | null;
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
