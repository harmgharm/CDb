/**
 * Login Schema
 *
 * Accepts email or username as the identifier.
 */

import { z } from "zod";

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Email or username is required")
    .transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
