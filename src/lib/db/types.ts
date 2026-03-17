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

export type UserRole = "admin" | "moderator" | "member";
export type MediaType = "movie" | "tv" | "anime";
export type WatchlistStatus = "planning" | "watching" | "scrapped";
export type RecommendationType = "content" | "collaborative" | "tmdb" | "jikan" | "group";
export type NotificationType =
  | "session.rate_pending"
  | "session.created"
  | "rating.submitted"
  | "watchlist.friend_watched";

export type GameMode = "solo" | "multiplayer";
export type GameDifficulty = "normal" | "hard";
export type GameStatus = "lobby" | "active" | "finished";

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
  | "invite.updated"
  | "invite.deleted"
  | "invite.used"
  | "media.bulk_refresh"
  | "watchlist.added"
  | "watchlist.updated"
  | "watchlist.removed"
  | "recommendation.computed"
  | "recommendation.invalidated"
  | "recommendation.dismissed"
  | "recommendation.undismissed"
  | "notification.created"
  | "notification.read"
  | "notification.read_all"
  | "notification.deleted"
  | "notification.cleared"
  | "game.created"
  | "game.started"
  | "game.finished"
  | "game.round_won";

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
  directors: JsonColumn<string[]> | null;
  imdb_id: string | null;
  tmdb_rating: number | null;
  mal_score: number | null;
  status: string | null;
  original_title: string | null;
  tagline: string | null;
  vote_count: number | null;
  season_count: number | null;
  trailer_key: string | null;
  origin_country: JsonColumn<string[]> | null;
  certification: string | null;
  networks: JsonColumn<string[]> | null;
  budget: ColumnType<string, number | bigint, number | bigint> | null;
  revenue: ColumnType<string, number | bigint, number | bigint> | null;
  studios: JsonColumn<string[]> | null;
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
  picked_by_user_id: string | null;
  created_by_user_id: string | null;
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
  /** decimal(3,1) — Postgres returns as string, insert/update as number */
  score: ColumnType<string, number, number>;
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

export interface RefreshTokensTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  family: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Generated<Date>;
}

export type RefreshToken = Selectable<RefreshTokensTable>;
export type NewRefreshToken = Insertable<RefreshTokensTable>;

// ============================================

export interface AuditLogTable {
  id: Generated<string>;
  user_id: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  metadata: JsonColumn<Record<string, unknown>> | null;
  created_at: Generated<Date>;
}

export type AuditLogEntry = Selectable<AuditLogTable>;
export type NewAuditLogEntry = Insertable<AuditLogTable>;

// ============================================

export interface WatchlistTable extends TimestampColumns {
  id: Generated<string>;
  user_id: string;
  media_id: string | null;
  ext_title: string | null;
  ext_poster_url: string | null;
  ext_media_type: MediaType | null;
  tmdb_id: number | null;
  mal_id: number | null;
  status: Generated<WatchlistStatus>;
  notes: string | null;
}

export type WatchlistEntry = Selectable<WatchlistTable>;
export type NewWatchlistEntry = Insertable<WatchlistTable>;
export type WatchlistEntryUpdate = Updateable<WatchlistTable>;

// ============================================

export interface RecommendationCacheTable {
  id: Generated<string>;
  user_id: string | null;
  rec_type: RecommendationType;
  media_id: string | null;
  tmdb_id: number | null;
  mal_id: number | null;
  ext_title: string | null;
  ext_poster_url: string | null;
  ext_media_type: MediaType | null;
  ext_overview: string | null;
  ext_release_year: number | null;
  ext_vote_average: ColumnType<string, number, number> | null;
  ext_genres: JsonColumn<string[]> | null;
  score: ColumnType<string, number, number>;
  reasons: JsonColumn<{ tag: string; detail: string }[]>;
  computed_at: Generated<Date>;
  expires_at: Date;
}

export type RecommendationCache = Selectable<RecommendationCacheTable>;
export type NewRecommendationCache = Insertable<RecommendationCacheTable>;

// ============================================

export interface TmdbRecommendationCacheTable {
  id: Generated<string>;
  source_type: string;
  source_tmdb_id: number | null;
  source_mal_id: number | null;
  recommendations: JsonColumn<unknown[]>;
  fetched_at: Generated<Date>;
  expires_at: Date;
}

export type TmdbRecommendationCacheEntry = Selectable<TmdbRecommendationCacheTable>;
export type NewTmdbRecommendationCache = Insertable<TmdbRecommendationCacheTable>;

// ============================================

export interface RecommendationDismissalsTable {
  id: Generated<string>;
  user_id: string;
  media_id: string | null;
  tmdb_id: number | null;
  mal_id: number | null;
  ext_title: string | null;
  ext_poster_url: string | null;
  ext_media_type: MediaType | null;
  created_at: Generated<Date>;
}

export type RecommendationDismissal = Selectable<RecommendationDismissalsTable>;
export type NewRecommendationDismissal = Insertable<RecommendationDismissalsTable>;

// ============================================

export interface NotificationPreferencesTable extends TimestampColumns {
  id: Generated<string>;
  user_id: string;
  preferences: JsonColumn<Record<string, boolean>>;
}

export type NotificationPreferences = Selectable<NotificationPreferencesTable>;
export type NewNotificationPreferences = Insertable<NotificationPreferencesTable>;
export type NotificationPreferencesUpdate = Updateable<NotificationPreferencesTable>;

// ============================================

export interface NotificationsTable {
  id: Generated<string>;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  is_read: Generated<boolean>;
  metadata: JsonColumn<Record<string, unknown>> | null;
  created_at: Generated<Date>;
}

export type Notification = Selectable<NotificationsTable>;
export type NewNotification = Insertable<NotificationsTable>;
export type NotificationUpdate = Updateable<NotificationsTable>;

// ============================================

export interface GameSessionsTable {
  id: Generated<string>;
  mode: GameMode;
  difficulty: GameDifficulty;
  status: Generated<GameStatus>;
  round_count: Generated<number>;
  current_round: Generated<number>;
  created_by_user_id: string;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Generated<Date>;
}

export type GameSession = Selectable<GameSessionsTable>;
export type NewGameSession = Insertable<GameSessionsTable>;
export type GameSessionUpdate = Updateable<GameSessionsTable>;

// ============================================

export interface GameRoundsTable {
  id: Generated<string>;
  game_id: string;
  round_number: number;
  media_id: string | null;
  tmdb_id: number | null;
  mal_id: number | null;
  poster_url: string;
  title: string;
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Generated<Date>;
}

export type GameRound = Selectable<GameRoundsTable>;
export type NewGameRound = Insertable<GameRoundsTable>;
export type GameRoundUpdate = Updateable<GameRoundsTable>;

// ============================================

export interface GameGuessesTable {
  id: Generated<string>;
  round_id: string;
  user_id: string;
  guess_text: string;
  matched_media_id: string | null;
  is_correct: boolean;
  time_from_start_ms: number;
  score_awarded: Generated<number>;
  created_at: Generated<Date>;
}

export type GameGuess = Selectable<GameGuessesTable>;
export type NewGameGuess = Insertable<GameGuessesTable>;

// ============================================

export interface GameLeaderboardTable {
  id: Generated<string>;
  user_id: string;
  games_played: Generated<number>;
  games_won: Generated<number>;
  rounds_won: Generated<number>;
  total_score: Generated<number>;
  best_streak: Generated<number>;
  avg_guess_time_ms: Generated<number>;
  updated_at: Generated<Date>;
}

export type GameLeaderboardEntry = Selectable<GameLeaderboardTable>;
export type NewGameLeaderboardEntry = Insertable<GameLeaderboardTable>;
export type GameLeaderboardUpdate = Updateable<GameLeaderboardTable>;

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
  refresh_tokens: RefreshTokensTable;
  audit_log: AuditLogTable;
  watchlist: WatchlistTable;
  recommendation_cache: RecommendationCacheTable;
  tmdb_recommendation_cache: TmdbRecommendationCacheTable;
  recommendation_dismissals: RecommendationDismissalsTable;
  notifications: NotificationsTable;
  notification_preferences: NotificationPreferencesTable;
  game_sessions: GameSessionsTable;
  game_rounds: GameRoundsTable;
  game_guesses: GameGuessesTable;
  game_leaderboard: GameLeaderboardTable;
}
