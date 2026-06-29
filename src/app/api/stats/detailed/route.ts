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
  fetchCastStats,
  fetchDirectorStats,
  fetchDivisiveMedia,
  fetchGenreStats,
  fetchHoursWatched,
  fetchPickerLeaderboard,
  fetchRankedMedia,
  fetchRatedTitleCount,
  fetchStreakData,
  fetchYearStats,
  formatCastStats,
  formatDirectorStats,
  formatGenreStats,
  formatRankedMedia,
  formatYearStats,
} from "@/lib/stats/queries";
import { computeStreaks } from "@/lib/stats/streak";
import { fetchAvgSessionLength, fetchWeekdayCounts } from "@/lib/stats/viewing-habits";
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
    castStatsRaw,
    yearStatsRaw,
    pickerLeaderboard,
    weekday,
    avgSessionLength,
    ratedTitleCount,
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
    fetchCastStats(),
    fetchYearStats(),
    fetchPickerLeaderboard(5),
    fetchWeekdayCounts(),
    fetchAvgSessionLength(),
    fetchRatedTitleCount(),
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

  // Format cast stats
  const castStats = formatCastStats(castStatsRaw);
  const castWithScore = castStats.filter((c) => c.avgScore !== null);
  const castByScore = castWithScore.toSorted((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));

  // Format year stats
  const yearStats = formatYearStats(yearStatsRaw);
  const yearsWithScore = yearStats.filter((y) => y.avgScore !== null);
  const yearsByScore = yearsWithScore.toSorted((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
  const yearsByCount = yearStats.toSorted((a, b) => a.count - b.count);

  // Real totals for the Deep Cuts tab labels, from the full formatted arrays
  // (before the top-5 slicing) so the counts reflect the whole pool.
  const years = yearStats.map((y) => y.year);
  const yearRange: [number, number] | null =
    years.length === 0 ? null : [Math.min(...years), Math.max(...years)];

  const result: GroupDetailedStats = {
    watchingHabits: {
      longestStreak: streaks.longest,
      currentStreak: streaks.current,
      hoursWatched,
      avgStartTime,
      avgRating,
      weekday,
      avgSessionLength,
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
    cast: {
      mostWatched: castStats.slice(0, 5),
      highestRated: castByScore.slice(0, 5),
      lowestRated: castByScore.toReversed().slice(0, 5),
    },
    years: {
      mostWatched: yearStats.slice(0, 5),
      leastWatched: yearsByCount.slice(0, 5),
      highestRated: yearsByScore.slice(0, 5),
      lowestRated: yearsByScore.toReversed().slice(0, 5),
    },
    pickerLeaderboard,
    totals: {
      ratedTitles: ratedTitleCount,
      genres: genreStats.length,
      directors: directorStats.length,
      cast: castStats.length,
      yearRange,
      pickers: pickerLeaderboard.length,
    },
  };

  return successResponse(result);
}
