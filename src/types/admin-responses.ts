/**
 * Frontend types for admin API responses
 */

import type { AuditAction, UserRole } from "@/lib/db/types";

/** Audit log entry from GET /api/admin/audit-log */
export interface AuditLogEntry {
  readonly id: string;
  readonly action: AuditAction;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly metadata: Record<string, unknown> | null;
  readonly created_at: string;
  readonly user_id: string;
  readonly username: string;
  readonly display_name: string | null;
}

/** Paginated audit log response */
export interface AuditLogResponse {
  readonly items: AuditLogEntry[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}

/** User from GET /api/admin/users */
export interface AdminUser {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly display_name: string | null;
  readonly avatar_url: string | null;
  readonly role: UserRole;
  readonly created_at: string;
}

/** Invite code from GET /api/admin/invite-codes */
export interface InviteCodeItem {
  readonly id: string;
  readonly code: string;
  readonly expires_at: string;
  readonly created_at: string;
  readonly used_by_user_id: string | null;
  readonly created_by_username: string | null;
  readonly used_by_username: string | null;
}
