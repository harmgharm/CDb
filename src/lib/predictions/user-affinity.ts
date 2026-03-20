/**
 * User affinity data loader for the prediction engine.
 *
 * Loads a user's rating history and computes preference maps
 * for genres, directors, decades, formats, and runtime buckets.
 */

import { sql } from "kysely";

import { db } from "@/lib/db";
import type { MediaType } from "@/lib/db/types";

import type { AffinityEntry, UserAffinityData } from "./types";

interface RatingRow {
  score: string;
  media_type: MediaType;
  release_year: number | null;
  runtime_minutes: number | null;
  genres: string[];
  directors: string[] | null;
}

export function toDecade(year: number): number {
  return Math.floor(year / 10) * 10;
}

export function toRuntimeBucket(minutes: number): string {
  if (minutes < 100) return "short";
  if (minutes <= 150) return "medium";
  return "long";
}

export function addToAffinityMap<K>(map: Map<K, AffinityEntry>, key: K, score: number): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, { avg: score, count: 1 });
  } else {
    existing.avg = (existing.avg * existing.count + score) / (existing.count + 1);
    existing.count += 1;
  }
}

/** Process a single rating row into all affinity maps. */
export function processRow(
  row: RatingRow,
  score: number,
  maps: {
    genre: Map<string, AffinityEntry>;
    director: Map<string, AffinityEntry>;
    decade: Map<number, AffinityEntry>;
    format: Map<MediaType, AffinityEntry>;
    runtime: Map<string, AffinityEntry>;
  },
): void {
  for (const genre of row.genres) {
    addToAffinityMap(maps.genre, genre, score);
  }

  if (row.directors !== null) {
    for (const director of row.directors) {
      addToAffinityMap(maps.director, director, score);
    }
  }

  if (row.release_year !== null) {
    addToAffinityMap(maps.decade, toDecade(row.release_year), score);
  }

  addToAffinityMap(maps.format, row.media_type, score);

  if (row.runtime_minutes !== null) {
    addToAffinityMap(maps.runtime, toRuntimeBucket(row.runtime_minutes), score);
  }
}

/**
 * Load all user preferences in a single pass over their ratings.
 * Returns Maps for O(1) lookup by each signal computer.
 */
export async function loadUserAffinity(userId: string): Promise<UserAffinityData> {
  const rows = await sql<RatingRow>`
    SELECT
      r.score,
      m.type as media_type,
      m.release_year,
      m.runtime_minutes,
      m.genres,
      m.directors
    FROM ratings r
    JOIN watch_sessions ws ON ws.id = r.session_id
    JOIN media m ON m.id = ws.media_id
    WHERE r.user_id = ${userId}
  `.execute(db);

  const maps = {
    genre: new Map<string, AffinityEntry>(),
    director: new Map<string, AffinityEntry>(),
    decade: new Map<number, AffinityEntry>(),
    format: new Map<MediaType, AffinityEntry>(),
    runtime: new Map<string, AffinityEntry>(),
  };

  let totalScore = 0;
  const ratingCount = rows.rows.length;

  for (const row of rows.rows) {
    const score = Number(row.score);
    totalScore += score;
    processRow(row, score, maps);
  }

  return {
    genreScores: maps.genre,
    directorScores: maps.director,
    decadeScores: maps.decade,
    formatScores: maps.format,
    runtimeBucketScores: maps.runtime,
    overallAvg: ratingCount > 0 ? totalScore / ratingCount : 5.5,
    ratingCount,
  };
}
