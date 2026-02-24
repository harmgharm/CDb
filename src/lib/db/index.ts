/**
 * Database Module
 *
 * Public exports for database access.
 */

export { checkDatabaseConnection, closeDatabase, db } from "./client";
export type { DatabaseTransaction } from "./transaction";
export { withTransaction } from "./transaction";
export type {
  AuditAction,
  AuditLogEntry,
  Database,
  InviteCode,
  Media,
  MediaType,
  NewAuditLogEntry,
  NewInviteCode,
  NewMedia,
  NewRating,
  NewSessionAttendee,
  NewUser,
  NewWatchSession,
  Rating,
  SessionAttendee,
  User,
  UserRole,
  WatchSession,
} from "./types";
