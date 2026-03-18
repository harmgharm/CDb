/**
 * Game Validation Schemas
 */

import { z } from "zod";

export const createGameSchema = z.object({
  mode: z.enum(["solo", "multiplayer"]).default("solo"),
  difficulty: z.enum(["normal", "hard"]),
  roundCount: z.coerce.number().int().min(1).max(20).default(5),
});

export type CreateGameInput = z.infer<typeof createGameSchema>;

export const submitGuessSchema = z.object({
  roundId: z.uuid("Invalid round ID"),
  guessText: z.string().min(1, "Guess cannot be empty").max(500),
  mediaId: z.uuid("Invalid media ID").optional(),
  timeFromStartMs: z.number().int().min(0).max(60_000),
});

export type SubmitGuessInput = z.infer<typeof submitGuessSchema>;

export const leaderboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type LeaderboardQueryInput = z.infer<typeof leaderboardQuerySchema>;

export const invitePlayersSchema = z.object({
  userIds: z.array(z.uuid("Invalid user ID")).min(1).max(9),
});

export type InvitePlayersInput = z.infer<typeof invitePlayersSchema>;
