/**
 * Migration 0031: refresh_tokens.replaced_by — rotation grace-period support
 *
 * Refresh-token rotation + reuse detection has a benign race: a consumed token
 * can reappear (a request sent before the new cookie committed, or a refresh
 * firing just after the prior one resolved). Treating that as theft revokes the
 * whole family and 401s every in-flight request (the source of the Ably 80017
 * cascade). The fix is a short grace window where a recently-revoked token is
 * handed its successor instead of nuking the family.
 *
 * `replaced_by` records each rotated token's successor (FK to the new token's
 * id), so a racing request can deterministically follow the chain to the
 * family's current valid token rather than guessing it by query. Nullable: the
 * latest (unrevoked) token in a family has no successor yet.
 */

import type { Kysely } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("refresh_tokens")
    .addColumn("replaced_by", "uuid", (col) =>
      col.references("refresh_tokens.id").onDelete("set null"),
    )
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.alterTable("refresh_tokens").dropColumn("replaced_by").execute();
}
