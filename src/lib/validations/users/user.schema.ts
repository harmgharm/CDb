/**
 * User validation schemas
 */

import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  avatarUrl: z.url().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
