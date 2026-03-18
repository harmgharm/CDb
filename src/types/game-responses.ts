/**
 * Response types for the Poster Reveal Guessing Game
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
  /** NULL for rounds that haven't started yet (anti-cheat) */
  posterUrl: string | null;
  /** NULL for rounds that haven't ended yet (anti-cheat) */
  title: string | null;
  mediaId: string | null;
  tmdbId: number | null;
  malId: number | null;
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
}

// ── Guess Submission Result ──────────────────────────────────────

export interface GuessResultResponse {
  isCorrect: boolean;
  scoreAwarded: number;
  streakBonus: number;
  currentStreak: number;
  correctTitle: string;
  correctPosterUrl: string;
  roundScore: number;
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
  posterUrl: string;
  startedAt: string;
}

export interface PlayerGuessedEvent {
  userId: string;
  username: string;
  isCorrect: boolean;
  scoreAwarded: number;
  /** True if this was the first correct guess (triggers countdown) */
  isFirstCorrect: boolean;
}

export interface RoundCountdownEvent {
  /** ISO timestamp when the round will auto-advance */
  endsAt: string;
  /** Whether all players have guessed (immediate advance) */
  allGuessed: boolean;
}

export interface RoundEndedEvent {
  roundNumber: number;
  correctTitle: string;
  correctPosterUrl: string;
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
  posterUrl: string;
  startedAt: string;
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
