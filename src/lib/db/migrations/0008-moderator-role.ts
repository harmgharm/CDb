/**
 * Migration 0008: Add moderator role
 *
 * The role column is a varchar(20) with no CHECK constraint,
 * so no schema change is needed. This migration documents the
 * addition of the "moderator" role as a valid value.
 *
 * Moderators have the same content-moderation permissions as admins
 * (edit/delete sessions, ratings, media) but cannot access the
 * admin panel (audit log, user management, invite codes).
 */

import type { Kysely } from "kysely";

export async function up(_db: Kysely<never>): Promise<void> {
  // No schema change needed — role is varchar(20) without a CHECK constraint.
  // The "moderator" value is now accepted by the application layer.
}

export async function down(_db: Kysely<never>): Promise<void> {
  // No rollback needed — this is a documentation-only migration.
}
