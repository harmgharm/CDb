/**
 * Register Schema (Invite-Only)
 */

import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-zA-Z]/, "Username must start with a letter")
  .regex(/^\w+$/, "Username can only contain letters, numbers, and underscores")
  .transform((username) => username.toLowerCase());

export const emailSchema = z
  .email("Invalid email address")
  .max(255, "Email must be at most 255 characters")
  .transform((email) => email.toLowerCase().trim());

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().min(1).max(50).optional(),
  inviteCode: z.string().min(1, "Invite code is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
