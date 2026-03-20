import { z } from "zod";

export const recommendationQuerySchema = z.object({
  type: z.enum(["content", "collaborative", "tmdb", "group"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(60),
  refresh: z.coerce.boolean().default(false),
  mediaType: z
    .string()
    .transform((value) => value.split(",").filter((v) => ["movie", "tv", "anime"].includes(v)))
    .optional(),
  genre: z
    .string()
    .transform((value) => value.split(",").filter((v) => v.length > 0))
    .optional(),
  decade: z
    .string()
    .transform((value) => value.split(",").filter((v) => /^(\d{4}|older)$/.test(v)))
    .optional(),
});

export type RecommendationQueryInput = z.infer<typeof recommendationQuerySchema>;
