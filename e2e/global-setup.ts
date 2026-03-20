/**
 * Playwright Global Setup
 *
 * Runs before all tests. Cleans up stale test data and seeds fresh data.
 */

import path from "node:path";

import dotenv from "dotenv";

import { cleanup, seed } from "./seed";

export default async function globalSetup(): Promise<void> {
  // Load .env.test so DATABASE_URL is available for seeding
  dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

  console.log("[e2e] Cleaning up previous test data...");
  await cleanup();

  console.log("[e2e] Seeding test data...");
  await seed();

  console.log("[e2e] Setup complete.");
}
