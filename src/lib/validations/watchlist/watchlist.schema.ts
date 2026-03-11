/**
 * Watchlist Validation Schemas
 */

import { z } from "zod";

const watchlistStatusSchema = z.enum(["planning", "watching", "scrapped"]);

export const addToWatchlistSchema = z
  .object({
    mediaId: z.uuid("Invalid media ID").optional(),
    tmdbId: z.number().int().positive().optional(),
    malId: z.number().int().positive().optional(),
    extTitle: z.string().min(1).max(500).optional(),
    extPosterUrl: z.string().nullable().optional(),
    extMediaType: z.enum(["movie", "tv", "anime"]).optional(),
    status: watchlistStatusSchema.default("planning"),
    notes: z.string().max(1000).optional(),
  })
  .refine(
    (data) => {
      const hasMedia = data.mediaId !== undefined;
      const hasExternal = data.tmdbId !== undefined || data.malId !== undefined;
      return hasMedia !== hasExternal;
    },
    { message: "Provide either mediaId OR (tmdbId or malId), not both" },
  )
  .refine(
    (data) => {
      const hasExternal = data.tmdbId !== undefined || data.malId !== undefined;
      if (!hasExternal) return true;
      return data.extTitle !== undefined && data.extMediaType !== undefined;
    },
    { message: "extTitle and extMediaType are required for unimported titles" },
  );

export type AddToWatchlistInput = z.infer<typeof addToWatchlistSchema>;

export const updateWatchlistEntrySchema = z.object({
  status: watchlistStatusSchema.optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export type UpdateWatchlistEntryInput = z.infer<typeof updateWatchlistEntrySchema>;

export const watchlistQuerySchema = z.object({
  userId: z.uuid().optional(),
  mediaId: z.uuid().optional(),
  status: watchlistStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type WatchlistQueryInput = z.infer<typeof watchlistQuerySchema>;
