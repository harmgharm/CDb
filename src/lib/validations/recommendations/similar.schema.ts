import { z } from "zod";

const similarSourceSchema = z.object({
  tmdbId: z.number().int().positive().optional(),
  malId: z.number().int().positive().optional(),
  mediaType: z.enum(["movie", "tv", "anime"]),
  title: z.string().min(1).max(500),
});

export const findSimilarRequestSchema = z.object({
  sources: z
    .array(similarSourceSchema)
    .min(1, "At least one source title is required")
    .max(5, "Maximum 5 source titles"),
  limit: z.number().int().min(1).max(100).default(20),
});

export type SimilarSource = z.infer<typeof similarSourceSchema>;
export type FindSimilarRequest = z.infer<typeof findSimilarRequestSchema>;
