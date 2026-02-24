/**
 * Database types for Kysely
 *
 * Each table interface maps to a Postgres table.
 * Uses Kysely's Generated<T> for auto-generated columns.
 */

import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

// ============================================
// ENUMS
// ============================================

export type UserRole = "admin" | "member";
export type MediaType = "movie" | "tv" | "anime";
export type AuditAction =
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "media.created"
  | "media.updated"
  | "media.deleted"
  | "session.created"
  | "session.updated"
  | "session.deleted"
  | "rating.created"
  | "rating.updated"
  | "rating.deleted"
  | "invite.created"
  | "invite.used";

// ============================================
// COMMON COLUMN PATTERNS
// ============================================

/**
 * Standard timestamp columns for audit trail
 */
export interface TimestampColumns {
  created_at: Generated<Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

// ============================================
// JSONB TYPE HELPER
// ============================================

/** ColumnType helper for JSONB fields */
export type JsonColumn<T> = ColumnType<T, string | T, string | T>;

// ============================================
// TABLES
// ============================================

export interface UsersTable extends TimestampColumns {
  id: Generated<string>;
  username: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  avatar_url: string | null;
  role: Generated<UserRole>;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

// ============================================

export interface MediaTable extends TimestampColumns {
  id: Generated<string>;
  title: string;
  type: MediaType;
  tmdb_id: number | null;
  mal_id: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  synopsis: string | null;
  genres: JsonColumn<string[]>;
  release_year: number | null;
  episode_count: number | null;
  runtime_minutes: number | null;
}

export type Media = Selectable<MediaTable>;
export type NewMedia = Insertable<MediaTable>;
export type MediaUpdate = Updateable<MediaTable>;

// ============================================

export interface WatchSessionsTable extends TimestampColumns {
  id: Generated<string>;
  media_id: string;
  date_watched: Date;
  time_watched_at: string | null;
  picked_by_user_id: string;
  notes: string | null;
}

export type WatchSession = Selectable<WatchSessionsTable>;
export type NewWatchSession = Insertable<WatchSessionsTable>;
export type WatchSessionUpdate = Updateable<WatchSessionsTable>;

// ============================================

export interface SessionAttendeesTable {
  id: Generated<string>;
  session_id: string;
  user_id: string;
  created_at: Generated<Date>;
}

export type SessionAttendee = Selectable<SessionAttendeesTable>;
export type NewSessionAttendee = Insertable<SessionAttendeesTable>;

// ============================================

export interface RatingsTable extends TimestampColumns {
  id: Generated<string>;
  session_id: string;
  user_id: string;
  score: number;
  review: string | null;
}

export type Rating = Selectable<RatingsTable>;
export type NewRating = Insertable<RatingsTable>;
export type RatingUpdate = Updateable<RatingsTable>;

// ============================================

export interface InviteCodesTable {
  id: Generated<string>;
  code: string;
  created_by_user_id: string;
  used_by_user_id: string | null;
  expires_at: Date;
  created_at: Generated<Date>;
}

export type InviteCode = Selectable<InviteCodesTable>;
export type NewInviteCode = Insertable<InviteCodesTable>;
export type InviteCodeUpdate = Updateable<InviteCodesTable>;

// ============================================

export interface AuditLogTable {
  id: Generated<string>;
  user_id: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  metadata: JsonColumn<Record<string, unknown>> | null;
  created_at: Generated<Date>;
}

export type AuditLogEntry = Selectable<AuditLogTable>;
export type NewAuditLogEntry = Insertable<AuditLogTable>;

// ============================================
// DATABASE INTERFACE
// ============================================

export interface Database {
  users: UsersTable;
  media: MediaTable;
  watch_sessions: WatchSessionsTable;
  session_attendees: SessionAttendeesTable;
  ratings: RatingsTable;
  invite_codes: InviteCodesTable;
  audit_log: AuditLogTable;
}
