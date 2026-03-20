/**
 * Playwright Global Teardown
 *
 * Runs after all tests. Removes test data from the database.
 */

import path from "node:path";

import dotenv from "dotenv";

import { cleanup } from "./seed";

export default async function globalTeardown(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

  console.log("[e2e] Cleaning up test data...");
  await cleanup();

  console.log("[e2e] Teardown complete.");
}
