/**
 * Database Module
 *
 * Public exports for database access.
 */

export { checkDatabaseConnection, closeDatabase, db } from "./client";
export { isUniqueViolation } from "./errors";
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
  NewRecommendationCache,
  NewSessionAttendee,
  NewTmdbRecommendationCache,
  NewUser,
  NewWatchlistEntry,
  NewWatchSession,
  Rating,
  RecommendationCache,
  RecommendationType,
  SessionAttendee,
  TmdbRecommendationCacheEntry,
  User,
  UserRole,
  WatchlistEntry,
  WatchlistEntryUpdate,
  WatchlistStatus,
  WatchSession,
} from "./types";
