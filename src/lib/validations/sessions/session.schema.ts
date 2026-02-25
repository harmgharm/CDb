/**
 * Watch Session & Rating Validation Schemas
 */

import { z } from "zod";

export const createSessionSchema = z.object({
  mediaId: z.uuid("Invalid media ID"),
  dateWatched: z.coerce.date(),
  timeWatchedAt: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format")
    .optional(),
  pickedByUserId: z.uuid("Invalid user ID"),
  attendeeIds: z.array(z.uuid()).min(1, "At least one attendee is required"),
  notes: z.string().max(1000).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const updateSessionSchema = createSessionSchema.partial().omit({ attendeeIds: true });

export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

export const ratingSchema = z.object({
  sessionId: z.uuid("Invalid session ID"),
  score: z.number().min(1, "Score must be at least 1").max(10, "Score must be at most 10"),
  review: z.string().max(1000).optional(),
});

export type RatingInput = z.infer<typeof ratingSchema>;

export const updateRatingSchema = z.object({
  score: z.number().min(1).max(10).optional(),
  review: z.string().max(1000).optional(),
});

export type UpdateRatingInput = z.infer<typeof updateRatingSchema>;

export const sessionQuerySchema = z.object({
  mediaId: z.uuid().optional(),
  userId: z.uuid().optional(),
  pickedBy: z.uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SessionQueryInput = z.infer<typeof sessionQuerySchema>;

export const addAttendeesSchema = z.object({
  userIds: z.array(z.uuid()).min(1, "At least one user ID is required"),
});

export type AddAttendeesInput = z.infer<typeof addAttendeesSchema>;
