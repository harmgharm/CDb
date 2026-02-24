/**
 * Media Validation Schemas
 */

import { z } from "zod";

export const mediaTypeSchema = z.enum(["movie", "tv", "anime"]);

export const createMediaSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  type: mediaTypeSchema,
  tmdbId: z.number().int().positive().optional(),
  malId: z.number().int().positive().optional(),
  posterUrl: z.url().optional(),
  backdropUrl: z.url().optional(),
  synopsis: z.string().max(5000).optional(),
  genres: z.array(z.string()).default([]),
  releaseYear: z.number().int().min(1888).max(2100).optional(),
  episodeCount: z.number().int().positive().optional(),
  runtimeMinutes: z.number().int().positive().optional(),
});

export type CreateMediaInput = z.infer<typeof createMediaSchema>;

export const updateMediaSchema = createMediaSchema.partial();

export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;

export const searchMediaSchema = z.object({
  query: z.string().min(1).max(200),
  type: mediaTypeSchema.optional(),
});

export type SearchMediaInput = z.infer<typeof searchMediaSchema>;
