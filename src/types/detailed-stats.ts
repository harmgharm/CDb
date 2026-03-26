/**
 * Types for detailed stats (home page group stats + user profile stats)
 */

import type { MediaType } from "@/lib/db/types";

// ============================================
// Shared shapes
// ============================================

/** Media item in a top/bottom leaderboard */
export interface RankedMedia {
  id: string;
  title: string;
  type: MediaType;
  posterUrl: string | null;
  avgScore: number;
  ratingCount: number;
}

/** Genre stat entry */
export interface GenreStat {
  genre: string;
  count: number;
  avgScore: number | null;
}

/** Director stat entry */
export interface DirectorStat {
  director: string;
  count: number;
  avgScore: number | null;
}

/** Cast stat entry */
export interface CastStat {
  actor: string;
  count: number;
  avgScore: number | null;
}

/** Year stat entry */
export interface YearStat {
  year: number;
  count: number;
  avgScore: number | null;
}

/** Picker in leaderboard */
export interface PickerLeaderboardEntry {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  pickCount: number;
  avgPickRating: number | null;
  topPicks: RankedMedia[];
}

/** Divisive media entry */
export interface DivisiveMedia {
  id: string;
  title: string;
  type: MediaType;
  posterUrl: string | null;
  avgScore: number;
  stddev: number;
}

// ============================================
// Group detailed stats (Home page)
// ============================================

export interface GroupDetailedStats {
  watchingHabits: {
    longestStreak: number;
    currentStreak: number;
    hoursWatched: number;
    avgStartTime: string | null;
    avgRating: number | null;
  };

  ratings: {
    highestRated: RankedMedia[];
    lowestRated: RankedMedia[];
    mostDivisive: DivisiveMedia[];
  };

  genres: {
    mostWatched: GenreStat[];
    leastWatched: GenreStat[];
    highestRated: GenreStat[];
    lowestRated: GenreStat[];
  };

  directors: {
    mostWatched: DirectorStat[];
    highestRated: DirectorStat[];
    lowestRated: DirectorStat[];
  };

  cast: {
    mostWatched: CastStat[];
    highestRated: CastStat[];
    lowestRated: CastStat[];
  };

  years: {
    mostWatched: YearStat[];
    leastWatched: YearStat[];
    highestRated: YearStat[];
    lowestRated: YearStat[];
  };

  pickerLeaderboard: PickerLeaderboardEntry[];
}

// ============================================
// User detailed stats (User profile page)
// ============================================

export interface UserDetailedStatsResponse {
  watchingHabits: {
    hoursWatched: number;
    attendanceRate: number;
    totalSessionsGlobal: number;
  };

  ratings: {
    avgRating: number | null;
    highestRated: RankedMedia[];
    lowestRated: RankedMedia[];
  };

  genres: {
    mostWatched: GenreStat[];
    leastWatched: GenreStat[];
    highestRated: GenreStat[];
    lowestRated: GenreStat[];
  };

  directors: {
    mostWatched: DirectorStat[];
    highestRated: DirectorStat[];
    lowestRated: DirectorStat[];
  };

  cast: {
    mostWatched: CastStat[];
    highestRated: CastStat[];
    lowestRated: CastStat[];
  };

  years: {
    mostWatched: YearStat[];
    leastWatched: YearStat[];
    highestRated: YearStat[];
    lowestRated: YearStat[];
  };

  picking: {
    pickRating: number | null;
    winRate: number | null;
    totalPicks: number;
    winCount: number;
  };
}

// ============================================
// Expanded public stats (Landing page)
// ============================================

export interface PublicStatsExpanded {
  mediaWatched: Partial<Record<MediaType, number>>;
  totalSessions: number;
  totalRatings: number;
  memberCount: number;
  hoursWatched: number;
  avgRating: number | null;
  mostWatchedGenre: string | null;
  recentMedia: {
    title: string;
    type: MediaType;
    posterUrl: string | null;
    dateWatched: string;
  }[];
  topMedia: {
    id: string;
    title: string;
    type: MediaType;
    posterUrl: string | null;
    avgScore: number;
    ratingCount: number;
  }[];
}
