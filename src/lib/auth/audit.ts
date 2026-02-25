/**
 * Audit logging helper
 */

import { db } from "@/lib/db";
import type { AuditAction } from "@/lib/db/types";

interface AuditEntry {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  await db
    .insertInto("audit_log")
    .values({
      user_id: entry.userId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    })
    .execute();
}
