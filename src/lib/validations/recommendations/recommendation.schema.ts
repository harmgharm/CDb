import { z } from "zod";

export const recommendationQuerySchema = z.object({
  type: z.enum(["content", "collaborative", "tmdb", "group"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(60),
  refresh: z.coerce.boolean().default(false),
});

export type RecommendationQueryInput = z.infer<typeof recommendationQuerySchema>;
