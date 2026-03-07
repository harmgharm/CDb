/**
 * Stats API response types
 */

import type { MediaType } from "@/lib/db/types";

export interface UserStat {
  id: string;
  username: string;
  displayName: string | null;
}

export interface DashboardStats {
  mediaWatched: Partial<Record<MediaType, number>>;
  totalSessions: number;
  totalRatings: number;
  hoursWatched: number;
  avgRating: number | null;
  topPicker: (UserStat & { pickCount: number }) | null;
  topRater: (UserStat & { avgScore: number }) | null;
  topAttendee: (UserStat & { attendanceCount: number }) | null;
  highestRated: {
    id: string;
    title: string;
    type: MediaType;
    posterUrl: string | null;
    avgScore: number;
  } | null;
  mostDivisive: {
    id: string;
    title: string;
    type: MediaType;
    stddev: number;
  } | null;
  lastSessionDate: string | null;
}

export interface FeedSessionItem {
  type: "session";
  data: {
    id: string;
    created_at: string;
    media_title: string;
    media_type: MediaType;
    media_poster_url: string | null;
    picker_username: string;
    picker_display_name: string | null;
  };
  createdAt: string;
}

export interface FeedRatingItem {
  type: "rating";
  data: {
    id: string;
    score: number;
    review: string | null;
    created_at: string;
    media_title: string;
    media_type: MediaType;
    username: string;
    display_name: string | null;
  };
  createdAt: string;
}

export type FeedItem = FeedSessionItem | FeedRatingItem;

export interface ActivityFeed {
  items: FeedItem[];
  page: number;
  limit: number;
}
