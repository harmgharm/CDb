/**
 * GET /api/users/[id]/stats/detailed — User-level detailed statistics
 *
 * Returns categorized stats scoped to a specific user: watching habits,
 * ratings, genres, directors, years, and picking stats.
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  fetchAttendanceRate,
  fetchAvgRating,
  fetchCastStats,
  fetchDirectorStats,
  fetchGenreStats,
  fetchHoursWatched,
  fetchPickerStats,
  fetchRankedMedia,
  fetchYearStats,
  formatCastStats,
  formatDirectorStats,
  formatGenreStats,
  formatRankedMedia,
  formatYearStats,
} from "@/lib/stats/queries";
import type { UserDetailedStatsResponse } from "@/types/detailed-stats";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const _user = await getAuthUser();
  if (!_user) {
    return errorResponse("Not authenticated", 401);
  }
  const { id } = await params;

  // Verify user exists
  const user = await db.selectFrom("users").select("id").where("id", "=", id).executeTakeFirst();

  if (user === undefined) {
    return errorResponse("User not found", 404);
  }

  const [
    hoursWatched,
    attendance,
    avgRating,
    highestRatedRaw,
    lowestRatedRaw,
    genreStatsRaw,
    directorStatsRaw,
    castStatsRaw,
    yearStatsRaw,
    pickerStats,
  ] = await Promise.all([
    fetchHoursWatched(id),
    fetchAttendanceRate(id),
    fetchAvgRating(id),
    fetchRankedMedia("desc", 5, id),
    fetchRankedMedia("asc", 5, id),
    fetchGenreStats(id),
    fetchDirectorStats(id),
    fetchCastStats(id),
    fetchYearStats(id),
    fetchPickerStats(id),
  ]);

  // Format and slice genre stats
  const genreStats = formatGenreStats(genreStatsRaw, 1);
  const genresWithScore = genreStats.filter((g) => g.avgScore !== null);
  const genresByScore = genresWithScore.toSorted((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));

  // Format and slice director stats
  const directorStats = formatDirectorStats(directorStatsRaw, 1);
  const directorsWithScore = directorStats.filter((d) => d.avgScore !== null);
  const directorsByScore = directorsWithScore.toSorted(
    (a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0),
  );

  // Format and slice cast stats
  const castStats = formatCastStats(castStatsRaw, 1);
  const castWithScore = castStats.filter((c) => c.avgScore !== null);
  const castByScore = castWithScore.toSorted((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));

  // Format and slice year stats
  const yearStats = formatYearStats(yearStatsRaw, 1);
  const yearsWithScore = yearStats.filter((y) => y.avgScore !== null);
  const yearsByScore = yearsWithScore.toSorted((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
  const yearsByCount = yearStats.toSorted((a, b) => a.count - b.count);

  const result: UserDetailedStatsResponse = {
    watchingHabits: {
      hoursWatched,
      attendanceRate: attendance.attendanceRate,
      totalSessionsGlobal: attendance.totalSessionsGlobal,
    },
    ratings: {
      avgRating,
      highestRated: formatRankedMedia(highestRatedRaw),
      lowestRated: formatRankedMedia(lowestRatedRaw),
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
    picking: pickerStats,
  };

  return successResponse(result);
}
