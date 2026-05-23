import type { MediaType } from "@/lib/db/types";

export interface PublicStats {
  readonly mediaWatched: Record<string, number>;
  readonly totalSessions: number;
  readonly totalRatings: number;
  readonly memberCount: number;
  readonly hoursWatched: number;
  readonly avgRating: number | null;
  readonly mostWatchedGenre: string | null;
  readonly recentMedia: readonly {
    readonly title: string;
    readonly type: MediaType;
    readonly posterUrl: string | null;
    readonly dateWatched: string;
  }[];
  readonly topMedia: readonly {
    readonly id: string;
    readonly title: string;
    readonly type: MediaType;
    readonly posterUrl: string | null;
    readonly avgScore: number;
    readonly ratingCount: number;
  }[];
}
