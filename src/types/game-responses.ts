/**
 * Response types for the game system
 */

import type {
  GameDifficulty,
  GameMode,
  GameStatus,
  GameType,
  LeaderboardCategory,
  MediaType,
} from "@/lib/db/types";

// ── Media Pool ───────────────────────────────────────────────────

export interface MediaPoolItem {
  id: string | null;
  tmdbId: number | null;
  malId: number | null;
  title: string;
  posterUrl: string;
  type: MediaType;
}

// ── Game Player ─────────────────────────────────────────────────

export interface GamePlayerResponse {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isHost: boolean;
  joinedAt: string;
  /** Accumulated score across all rounds (multiplayer) */
  totalScore: number;
  /** Number of rounds this player guessed correctly */
  roundsWon: number;
  /** Current consecutive correct streak */
  currentStreak: number;
}

// ── Game Session ─────────────────────────────────────────────────

export interface GameSessionResponse {
  id: string;
  gameType: GameType;
  mode: GameMode;
  difficulty: GameDifficulty;
  status: GameStatus;
  roundCount: number;
  currentRound: number;
  createdByUserId: string;
  isRanked: boolean;
  /** Custom round timer in seconds (1-15). Null = engine default. */
  timeLimitSeconds: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  rounds: GameRoundResponse[];
  /** Current user's total score (solo) or all players' scores (multiplayer via players) */
  totalScore: number;
  currentStreak: number;
  /** Only present for multiplayer games */
  players?: GamePlayerResponse[];
  /** Present on game finish — true if this game set a new personal best for ranked category */
  isNewPersonalBest?: boolean;
}

// ── Game Round ───────────────────────────────────────────────────

export interface GameRoundResponse {
  id: string;
  roundNumber: number;
  /** Game-specific round payload (masked by phase for anti-cheat) */
  roundData: Record<string, unknown>;
  startedAt: string | null;
  endedAt: string | null;
  /** When the first correct guess was submitted (for countdown timer) */
  firstCorrectAt: string | null;
  guesses: GameGuessResponse[];
}

// ── Game Guess ───────────────────────────────────────────────────

export interface GameGuessResponse {
  id: string;
  userId: string;
  /** Only included in multiplayer so clients can display who guessed */
  username?: string;
  guessText: string;
  isCorrect: boolean;
  timeFromStartMs: number;
  scoreAwarded: number;
  createdAt: string;
  /** Game-specific guess data (e.g. guessedRating for rating-guess). Only included for ended rounds. */
  guessData?: Record<string, unknown>;
}

// ── Guess Submission Result ──────────────────────────────────────

export interface GuessResultResponse {
  isCorrect: boolean;
  scoreAwarded: number;
  streakBonus: number;
  currentStreak: number;
  roundScore: number;
  /** Game-specific result data from the engine */
  resultData: Record<string, unknown>;
  /** Multiplayer only — true if this was the first correct guess in the round */
  isFirstCorrect?: boolean;
  /** Multiplayer only — bonus for being first correct guesser */
  firstCorrectBonus?: number;
}

// ── Leaderboard ──────────────────────────────────────────────────

export interface LeaderboardEntryResponse {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  gamesPlayed: number;
  gamesWon: number;
  roundsWon: number;
  bestScore: number;
  bestScoreGameId: string | null;
  bestStreak: number;
  avgGuessTimeMs: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntryResponse[];
  total: number;
  page: number;
  limit: number;
  category: LeaderboardCategory;
}

// ── Autocomplete ─────────────────────────────────────────────────

export interface GameMediaOption {
  id: string;
  title: string;
  posterUrl: string | null;
  releaseYear: number | null;
  type: MediaType;
}

// ── Ably Game Events ─────────────────────────────────────────────

export interface PlayerJoinedEvent {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface PlayerLeftEvent {
  userId: string;
}

export interface GameStartedEvent {
  currentRound: number;
  roundId: string;
  startedAt: string;
  /** Game-specific data for the first round */
  roundData: Record<string, unknown>;
}

export interface PlayerGuessedEvent {
  userId: string;
  username: string;
  isCorrect: boolean;
  scoreAwarded: number;
  /** True if this was the first correct guess (triggers countdown) */
  isFirstCorrect: boolean;
  /** Whether this player has finished the round (correct guess or skip — no more guesses expected) */
  isFinished: boolean;
}

export interface RoundCountdownEvent {
  /** ISO timestamp when the round will auto-advance */
  endsAt: string;
  /** Whether all players have guessed (immediate advance) */
  allGuessed: boolean;
}

export interface RoundEndedEvent {
  roundNumber: number;
  /** Game-specific data for the ended round (e.g. correct answer) */
  roundData: Record<string, unknown>;
  /** Per-player scores for this round */
  scores: {
    userId: string;
    username: string;
    scoreAwarded: number;
    isCorrect: boolean;
    isFirstCorrect: boolean;
    timeFromStartMs: number | null;
  }[];
}

export interface RoundStartedEvent {
  roundNumber: number;
  roundId: string;
  startedAt: string;
  /** Game-specific data for the new round */
  roundData: Record<string, unknown>;
}

export interface GameEndedEvent {
  finalStandings: {
    rank: number;
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    totalScore: number;
    roundsWon: number;
    bestStreak: number;
    avgGuessTimeMs: number;
  }[];
}

export interface LobbyClosed {
  reason: "host_left";
}

export interface RematchCreatedEvent {
  newGameId: string;
  createdBy: {
    userId: string;
    username: string;
    displayName: string | null;
  };
}
