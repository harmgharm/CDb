/**
 * Invite code validation schemas
 */

import { z } from "zod";

export const generateInviteCodeSchema = z.object({
  expiresInDays: z.coerce.number().int().min(1).max(365).default(30),
});

export type GenerateInviteCodeInput = z.infer<typeof generateInviteCodeSchema>;

export const updateInviteCodeSchema = z.object({
  expiresInDays: z.coerce.number().int().min(1).max(365),
});

export type UpdateInviteCodeInput = z.infer<typeof updateInviteCodeSchema>;
