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
  /** Sessions this user attended (watched), distinct from sessions they picked. */
  watchedCount: number;
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

/** A person on the featured card — the picker, or an attendee in the stack. */
export interface FeaturedPerson {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/** Featured media entry for the Database editorial band */
export interface FeaturedMedia {
  id: string;
  title: string;
  type: MediaType;
  posterUrl: string | null;
  avgScore: number;
  ratingCount: number;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  episodeCount: number | null;
  /**
   * Who picked the title and who attended, read from the canonical session the
   * group queue records (the most recent watched proposal's `watched_session_id`).
   * `picker` is null and `attendees` is empty when the title has no watched
   * queue proposal (logged off-queue, or pre-queue history) — the card then
   * omits the "Picked by" line and the attendee stack.
   */
  picker: FeaturedPerson | null;
  attendees: FeaturedPerson[];
}

/**
 * Response for the Database "Featured" band. `scope` reports whether the
 * ranking reflects the current month or fell back to all-time (when the month
 * has no qualifying ratings yet), so the UI can label the eyebrow honestly.
 */
export interface FeaturedResponse {
  scope: "month" | "all-time";
  main: FeaturedMedia | null;
  supporting: FeaturedMedia[];
}

// ============================================
// Group detailed stats (Home page)
// ============================================

export interface WeekdayBucketView {
  day: string;
  count: number;
  isPeak: boolean;
}

export interface GroupDetailedStats {
  watchingHabits: {
    longestStreak: number;
    currentStreak: number;
    hoursWatched: number;
    avgStartTime: string | null;
    avgRating: number | null;
    /** Monday-first day-of-week session histogram for the viewing-habits chart. */
    weekday: WeekdayBucketView[];
    /** Average session length formatted as "Xh Ym", or null with no runtime data. */
    avgSessionLength: string | null;
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

  /** Real totals for the Deep Cuts tab labels (full counts, not the shown slice). */
  totals: {
    ratedTitles: number;
    genres: number;
    directors: number;
    cast: number;
    /** [earliest, latest] release year across watched titles, or null if none. */
    yearRange: [number, number] | null;
    pickers: number;
  };
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
