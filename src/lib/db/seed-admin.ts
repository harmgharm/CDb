/* eslint-disable no-console, unicorn/no-process-exit */

/**
 * Admin Seed Script (CLI)
 *
 * Creates the first admin user and generates an initial invite code.
 *
 * Usage:
 *   ADMIN_PASSWORD=yourpassword npm run db:seed:admin
 *
 * Environment variables:
 *   ADMIN_EMAIL     — Admin email (default: admin@cdb.local)
 *   ADMIN_USERNAME  — Admin username (default: admin)
 *   ADMIN_PASSWORD  — Admin password (required, no default)
 */

import { randomUUID } from "node:crypto";

import { hashPassword } from "@/lib/auth/passwords";
import { db } from "@/lib/db";

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL ?? "admin@cdb.local";
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "";

  if (password.length === 0) {
    console.error("Error: ADMIN_PASSWORD environment variable is required.");
    // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- usage example, not a real password
    console.error("Usage: ADMIN_PASSWORD=yourpassword npm run db:seed:admin");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters.");
    process.exit(1);
  }

  // Check if admin already exists
  const existing = await db
    .selectFrom("users")
    .select("id")
    .where("role", "=", "admin")
    .executeTakeFirst();

  if (existing) {
    console.error("Error: An admin user already exists.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const admin = await db
    .insertInto("users")
    .values({
      email,
      username,
      password_hash: passwordHash,
      display_name: "Admin",
      role: "admin",
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  console.log(`Admin user created: ${admin.username} (${admin.email})`);

  // Generate invite code
  const code = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await db
    .insertInto("invite_codes")
    .values({
      code,
      created_by_user_id: admin.id,
      expires_at: expiresAt,
    })
    .execute();

  console.log(`\nInvite code: ${code}`);
  console.log(`Expires: ${expiresAt.toISOString()}`);
  console.log("\nShare this code with your first member to sign up.");

  await db.destroy();
  process.exit(0);
}

seedAdmin().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
