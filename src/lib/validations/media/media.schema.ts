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
  directors: z.array(z.string()).optional(),
  imdbId: z.string().max(20).optional(),
  tmdbRating: z.number().min(0).max(10).optional(),
  malScore: z.number().min(0).max(10).optional(),
  status: z.string().max(50).optional(),
  originalTitle: z.string().max(500).optional(),
  tagline: z.string().max(1000).optional(),
  voteCount: z.number().int().nonnegative().optional(),
  seasonCount: z.number().int().positive().optional(),
  trailerKey: z.string().max(20).optional(),
  originCountry: z.array(z.string()).optional(),
  certification: z.string().max(20).optional(),
  networks: z.array(z.string()).optional(),
  budget: z.number().int().nonnegative().optional(),
  revenue: z.number().int().nonnegative().optional(),
  studios: z.array(z.string()).optional(),
});

export type CreateMediaInput = z.infer<typeof createMediaSchema>;

export const updateMediaSchema = createMediaSchema.partial();

export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;

export const searchMediaSchema = z.object({
  query: z.string().min(1).max(200),
  type: mediaTypeSchema.optional(),
});

export type SearchMediaInput = z.infer<typeof searchMediaSchema>;

export const importMediaSchema = z
  .object({
    tmdbId: z.number().int().positive().optional(),
    malId: z.number().int().positive().optional(),
    type: mediaTypeSchema,
  })
  .refine((data) => data.tmdbId !== undefined || data.malId !== undefined, {
    message: "Either tmdbId or malId is required",
  });

export type ImportMediaInput = z.infer<typeof importMediaSchema>;

export const mediaQuerySchema = z.object({
  type: mediaTypeSchema.optional(),
  genre: z.string().optional(),
  yearFrom: z.coerce.number().int().min(1888).optional(),
  yearTo: z.coerce.number().int().max(2100).optional(),
  search: z.string().max(200).optional(),
  sortBy: z
    .enum(["title", "rating", "date_watched", "release_year", "created_at"])
    .default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type MediaQueryInput = z.infer<typeof mediaQuerySchema>;
