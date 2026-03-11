import { z } from "zod";

export const recommendationQuerySchema = z.object({
  type: z.enum(["content", "collaborative", "tmdb", "group"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(60),
  refresh: z.coerce.boolean().default(false),
  mediaType: z.enum(["movie", "tv", "anime"]).optional(),
  genre: z.string().min(1).max(100).optional(),
  decade: z
    .string()
    .regex(/^(\d{4}|older)$/)
    .optional(),
});

export type RecommendationQueryInput = z.infer<typeof recommendationQuerySchema>;
