/**
 * Playwright Global Setup
 *
 * Runs before all tests. Brings the e2e database schema up to date, then
 * cleans up stale test data and seeds fresh data.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";

import dotenv from "dotenv";

import { cleanup, seed } from "./seed";

export default async function globalSetup(): Promise<void> {
  // Load .env.test so DATABASE_URL is available for seeding
  dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

  // Apply any pending migrations to the e2e branch first. The e2e database is a
  // standalone Neon branch that does not auto-follow new migrations, so without
  // this it silently drifts behind the migration files and queries hit missing
  // columns at runtime. Run the migrate CLI in its own ESM tsx context (it can't
  // be imported into Playwright's setup) via the local tsx binary at an absolute
  // path, so no PATH lookup is involved.
  console.log("[e2e] Migrating e2e database to latest...");
  const tsxBin = path.resolve(process.cwd(), "node_modules/.bin/tsx");
  execFileSync(tsxBin, ["-r", "dotenv/config", "src/lib/db/migrate.ts"], {
    stdio: "inherit",
    env: { ...process.env, DOTENV_CONFIG_PATH: ".env.test" },
  });

  console.log("[e2e] Cleaning up previous test data...");
  await cleanup();

  console.log("[e2e] Seeding test data...");
  await seed();

  console.log("[e2e] Setup complete.");
}
