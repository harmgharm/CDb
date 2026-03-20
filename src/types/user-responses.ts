/**
 * Frontend types for user API responses
 */

import type { GameDifficulty, GameMode, GameType, MediaType, UserRole } from "@/lib/db/types";

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

/** Individual rating within a bucket */
export interface RatingDetail {
  mediaId: string;
  title: string;
  posterUrl: string | null;
  score: number;
}

/** Rating distribution bucket */
export interface RatingBucket {
  score: number;
  count: number;
  ratings: RatingDetail[];
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
  /** Avg session rating (null if < 2 ratings) */
  avgScore: number | null;
}

/** User detailed stats from GET /api/users/[id]/stats */
export interface UserDetailedStats {
  ratingDistribution: RatingBucket[];
  topGenres: GenreCount[];
  recentPicks: RecentPick[];
}

// ── Game Stats ──────────────────────────────────────────────────

/** Recent game entry for user profile */
export interface UserRecentGame {
  gameId: string;
  gameType: GameType;
  mode: GameMode;
  difficulty: GameDifficulty;
  roundCount: number;
  finishedAt: string | null;
  totalScore: number;
  correctCount: number;
  isWinner: boolean;
  isRanked: boolean;
  /** Rating guesser only: average difference from correct rating */
  avgDifference?: number;
}

/** Per-game-type stats block */
export interface GameTypeStats {
  gamesPlayed: number;
  gamesWon: number;
  roundsWon: number;
  bestScoreNormal: number | null;
  bestScoreHard: number | null;
  bestStreak: number;
  avgGuessTimeMs: number;
  globalRankNormal: number | null;
  globalRankHard: number | null;
  recentGames: UserRecentGame[];
}

/** Game stats from GET /api/users/[id]/games/stats (per-game-type) */
export interface UserGameStatsResponse {
  posterReveal: GameTypeStats | null;
  ratingGuess: GameTypeStats | null;
}
