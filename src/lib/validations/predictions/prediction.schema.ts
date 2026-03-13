import { z } from "zod";

export const predictionRequestSchema = z
  .object({
    mediaId: z.uuid().optional(),
    tmdbId: z.number().int().positive().optional(),
    malId: z.number().int().positive().optional(),
    mediaType: z.enum(["movie", "tv", "anime"]),
  })
  .refine(
    (data) => data.mediaId !== undefined || data.tmdbId !== undefined || data.malId !== undefined,
    { message: "At least one of mediaId, tmdbId, or malId is required" },
  );

export type PredictionRequestInput = z.infer<typeof predictionRequestSchema>;

const batchItemSchema = z
  .object({
    key: z.string().min(1),
    mediaId: z.uuid().optional(),
    tmdbId: z.number().int().positive().optional(),
    malId: z.number().int().positive().optional(),
    mediaType: z.enum(["movie", "tv", "anime"]),
  })
  .refine(
    (data) => data.mediaId !== undefined || data.tmdbId !== undefined || data.malId !== undefined,
    { message: "At least one of mediaId, tmdbId, or malId is required" },
  );

export const batchPredictionRequestSchema = z.object({
  items: z.array(batchItemSchema).min(1).max(50),
});

export type BatchPredictionRequestInput = z.infer<typeof batchPredictionRequestSchema>;
