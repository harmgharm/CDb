/**
 * GET /api/stats/detailed — Group-level detailed statistics
 *
 * Returns categorized stats: watching habits, ratings, genres,
 * directors, years, and picker leaderboard.
 */

import { successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import {
  fetchAvgRating,
  fetchAvgStartTime,
  fetchDirectorStats,
  fetchDivisiveMedia,
  fetchGenreStats,
  fetchHoursWatched,
  fetchPickerLeaderboard,
  fetchRankedMedia,
  fetchStreakData,
  fetchYearStats,
  formatDirectorStats,
  formatGenreStats,
  formatRankedMedia,
  formatYearStats,
} from "@/lib/stats/queries";
import { computeStreaks } from "@/lib/stats/streak";
import type { GroupDetailedStats } from "@/types/detailed-stats";

export async function GET() {
  await requireAuth();

  const [
    streakData,
    hoursWatched,
    avgStartTime,
    avgRating,
    highestRatedRaw,
    lowestRatedRaw,
    divisiveMedia,
    genreStatsRaw,
    directorStatsRaw,
    yearStatsRaw,
    pickerLeaderboard,
  ] = await Promise.all([
    fetchStreakData(),
    fetchHoursWatched(),
    fetchAvgStartTime(),
    fetchAvgRating(),
    fetchRankedMedia("desc", 5),
    fetchRankedMedia("asc", 5),
    fetchDivisiveMedia(3),
    fetchGenreStats(),
    fetchDirectorStats(),
    fetchYearStats(),
    fetchPickerLeaderboard(5),
  ]);

  // Compute streaks
  const today = new Date().toISOString().split("T")[0] ?? "";
  const streaks = computeStreaks(streakData, today);

  // Format genre stats and slice for categories
  const genreStats = formatGenreStats(genreStatsRaw);
  const genresWithScore = genreStats.filter((g) => g.avgScore !== null);
  const genresByScore = genresWithScore.toSorted((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));

  // Format director stats
  const directorStats = formatDirectorStats(directorStatsRaw);
  const directorsWithScore = directorStats.filter((d) => d.avgScore !== null);
  const directorsByScore = directorsWithScore.toSorted(
    (a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0),
  );

  // Format year stats
  const yearStats = formatYearStats(yearStatsRaw);
  const yearsWithScore = yearStats.filter((y) => y.avgScore !== null);
  const yearsByScore = yearsWithScore.toSorted((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
  const yearsByCount = yearStats.toSorted((a, b) => a.count - b.count);

  const result: GroupDetailedStats = {
    watchingHabits: {
      longestStreak: streaks.longest,
      currentStreak: streaks.current,
      hoursWatched,
      avgStartTime,
      avgRating,
    },
    ratings: {
      highestRated: formatRankedMedia(highestRatedRaw),
      lowestRated: formatRankedMedia(lowestRatedRaw),
      mostDivisive: divisiveMedia,
    },
    genres: {
      mostWatched: genreStats.slice(0, 5),
      leastWatched: genreStats.toSorted((a, b) => a.count - b.count).slice(0, 5),
      highestRated: genresByScore.slice(0, 5),
      lowestRated: genresByScore.toReversed().slice(0, 5),
    },
    directors: {
      mostWatched: directorStats.slice(0, 5),
      highestRated: directorsByScore.slice(0, 5),
      lowestRated: directorsByScore.toReversed().slice(0, 5),
    },
    years: {
      mostWatched: yearStats.slice(0, 5),
      leastWatched: yearsByCount.slice(0, 5),
      highestRated: yearsByScore.slice(0, 5),
      lowestRated: yearsByScore.toReversed().slice(0, 5),
    },
    pickerLeaderboard,
  };

  return successResponse(result);
}
