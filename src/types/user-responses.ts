/**
 * Frontend types for user API responses
 */

import type { MediaType, UserRole } from "@/lib/db/types";

/** User item from GET /api/users list */
export interface UserListItem {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

/** User profile from GET /api/users/[id] */
export interface UserProfile extends UserListItem {
  stats: {
    sessionsAttended: number;
    ratingsGiven: number;
    avgScore: number | null;
    pickCount: number;
  };
}

/** Rating distribution bucket */
export interface RatingBucket {
  score: number;
  count: number;
}

/** Genre count */
export interface GenreCount {
  genre: string;
  count: number;
}

/** Recent pick */
export interface RecentPick {
  session_id: string;
  date_watched: string;
  media_id: string;
  title: string;
  type: MediaType;
  poster_url: string | null;
}

/** User detailed stats from GET /api/users/[id]/stats */
export interface UserDetailedStats {
  ratingDistribution: RatingBucket[];
  topGenres: GenreCount[];
  recentPicks: RecentPick[];
}
