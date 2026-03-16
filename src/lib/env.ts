/**
 * Environment variable validation
 *
 * Validated at startup with Zod 4. Fails fast if any required
 * env vars are missing or invalid.
 */

import { z } from "zod";

// Reusable schemas
const databaseUrlSchema = z.url().startsWith("postgres");
const jwtSecretSchema = z.string().min(32);

/**
 * Server environment variables schema
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: databaseUrlSchema,

  // Auth
  JWT_SECRET: jwtSecretSchema,
  JWT_REFRESH_SECRET: jwtSecretSchema,

  // External APIs
  TMDB_API_KEY: z.string().min(1),
  TMDB_ACCESS_TOKEN: z.string().min(1).optional(),

  // Real-time (Ably)
  ABLY_API_KEY: z.string().min(1),

  // App
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

/**
 * Validate and export environment variables.
 * Throws on startup if validation fails.
 */
function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Invalid environment variables:");
    console.error(z.treeifyError(parsed.error));
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

export const env = validateEnv();

export type Env = z.infer<typeof envSchema>;
