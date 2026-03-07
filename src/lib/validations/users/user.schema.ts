/**
 * User validation schemas
 */

import { z } from "zod";

import { emailSchema, passwordSchema, usernameSchema } from "@/lib/validations/auth";

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  avatarUrl: z.url().optional(),
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateRoleSchema = z.object({
  role: z.enum(["admin", "moderator", "member"]),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
