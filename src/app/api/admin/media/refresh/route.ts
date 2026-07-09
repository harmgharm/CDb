/**
 * POST /api/admin/media/refresh
 *
 * Batch refresh media metadata from TMDB/Jikan.
 * Processes entries in cursor-based batches of 25.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  fetchAnimeMetadata,
  fetchMovieMetadata,
  fetchTvMetadata,
  metadataToDbFields,
} from "@/lib/api/metadata";
import { errorResponse, successResponse } from "@/lib/api/response";
import { getModeratorUser, logAudit } from "@/lib/auth";
import { db } from "@/lib/db";
import type { MediaType } from "@/lib/db/types";

const BATCH_SIZE = 25;
const TMDB_DELAY_MS = 100;

const refreshQuerySchema = z.object({
  cursor: z.string().optional(),
});

interface MediaEntry {
  id: string;
  title: string;
  type: MediaType;
  tmdb_id: number | null;
  mal_id: number | null;
}

interface RefreshError {
  id: string;
  title: string;
  error: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchAndUpdateEntry(entry: MediaEntry): Promise<string | null> {
  const { id, type, tmdb_id: tmdbId, mal_id: malId } = entry;

  if (type === "movie" && tmdbId !== null) {
    const metadata = await fetchMovieMetadata(tmdbId);
    await db
      .updateTable("media")
      .set({ ...metadataToDbFields(metadata), updated_at: new Date() })
      .where("id", "=", id)
      .execute();
    return null;
  }
  if (type === "tv" && tmdbId !== null) {
    const metadata = await fetchTvMetadata(tmdbId);
    await db
      .updateTable("media")
      .set({ ...metadataToDbFields(metadata), updated_at: new Date() })
      .where("id", "=", id)
      .execute();
    return null;
  }
  if (type === "anime" && malId !== null) {
    const metadata = await fetchAnimeMetadata(malId);
    await db
      .updateTable("media")
      .set({ ...metadataToDbFields(metadata), updated_at: new Date() })
      .where("id", "=", id)
      .execute();
    return null;
  }
  return "No valid external ID for refresh";
}

async function getMediaCount(afterCursor?: string): Promise<number> {
  let query = db
    .selectFrom("media")
    .select((expressionBuilder) => expressionBuilder.fn.countAll().as("count"));

  if (afterCursor !== undefined) {
    query = query.where("id", ">", afterCursor);
  }

  const result = await query.executeTakeFirstOrThrow();
  return Number(result.count);
}

async function processBatch(entries: MediaEntry[]): Promise<{
  refreshed: number;
  failed: number;
  errors: RefreshError[];
}> {
  let refreshed = 0;
  let failed = 0;
  const errors: RefreshError[] = [];

  for (const entry of entries) {
    try {
      const errorMessage = await fetchAndUpdateEntry(entry);
      if (errorMessage === null) {
        refreshed += 1;
      } else {
        failed += 1;
        errors.push({ id: entry.id, title: entry.title, error: errorMessage });
      }
    } catch (caughtError: unknown) {
      failed += 1;
      const message = caughtError instanceof Error ? caughtError.message : "Unknown error";
      errors.push({ id: entry.id, title: entry.title, error: message });
    }

    // Rate limit delay for TMDB entries (anime uses Jikan's built-in throttle)
    if (entry.type !== "anime") {
      await delay(TMDB_DELAY_MS);
    }
  }

  return { refreshed, failed, errors };
}

export async function POST(request: NextRequest) {
  const user = await getModeratorUser();
  if (!user) {
    return errorResponse("Not authorized", 403);
  }

  const body: unknown = await request.json();
  const parsed = refreshQuerySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { cursor } = parsed.data;
  const total = await getMediaCount();

  // Fetch batch
  let query = db
    .selectFrom("media")
    .select(["id", "title", "type", "tmdb_id", "mal_id"])
    .orderBy("id", "asc")
    .limit(BATCH_SIZE);

  if (cursor !== undefined) {
    query = query.where("id", ">", cursor);
  }

  const entries = await query.execute();

  if (entries.length === 0) {
    return successResponse({
      refreshed: 0,
      failed: 0,
      remaining: 0,
      nextCursor: null,
      total,
      errors: [],
    });
  }

  const result = await processBatch(entries);

  const lastEntry = entries.at(-1);
  const nextCursor = lastEntry === undefined ? null : lastEntry.id;
  const remaining = nextCursor === null ? 0 : await getMediaCount(nextCursor);

  await logAudit({
    userId: user.id,
    action: "media.bulk_refresh",
    entityType: "media",
    entityId: null,
    metadata: { ...result, batchSize: entries.length, cursor: cursor ?? "start" },
  });

  return successResponse({
    refreshed: result.refreshed,
    failed: result.failed,
    remaining,
    nextCursor: remaining > 0 ? nextCursor : null,
    total,
    errors: result.errors,
  });
}
