import { z } from "zod";

export const dismissRecommendationSchema = z
  .object({
    mediaId: z.uuid().optional(),
    tmdbId: z.number().int().positive().optional(),
    malId: z.number().int().positive().optional(),
    extTitle: z.string().min(1).max(500).optional(),
    extPosterUrl: z.string().nullable().optional(),
    extMediaType: z.enum(["movie", "tv", "anime"]).optional(),
  })
  .refine(
    (data) => data.mediaId !== undefined || data.tmdbId !== undefined || data.malId !== undefined,
    { message: "At least one of mediaId, tmdbId, or malId is required" },
  );

export type DismissRecommendationInput = z.infer<typeof dismissRecommendationSchema>;
