"use client";

/**
 * MultiplayerGame — Orchestrates the multiplayer Rating Guesser flow
 *
 * Driven by Ably events: round-started, player-guessed, round-countdown,
 * round-ended, game-ended. The host's client triggers round advancement
 * when the countdown expires.
 */

import { useChannel } from "ably/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LiveScoreboard } from "@/components/games/live-scoreboard";
import { ScoreHeader, SubmittedBanner } from "@/components/games/multiplayer-banners";
import {
  PlayerGuessIndicators,
  usePlayerGuessIndicators,
} from "@/components/games/player-guess-indicator";
import {
  getRatingResultHeader,
  RatingAnswerDisplay,
} from "@/components/games/rating-guess/rating-answer-display";
import {
  getRoundStartTime,
  RatingGuessVisual,
} from "@/components/games/rating-guess/rating-guess-visual";
import { DEFAULT_RATING_VALUE, RatingInput } from "@/components/games/rating-guess/rating-input";
import { RoundResult } from "@/components/games/round-result";
import { useAuth } from "@/components/providers/auth-provider";
import { useAutoSubmitTimer } from "@/hooks/use-auto-submit-timer";
import { useGameState, useNextRound, useSubmitGuess } from "@/hooks/use-games";
import {
  playCloseGuessSound,
  playCorrectSound,
  playFirstCorrectSound,
  playGameEndSound,
  playRoundStartSound,
  playWrongSound,
} from "@/lib/games/sounds";
import type { RatingGuessResultData, RatingGuessRoundData } from "@/types/game-engine-data";
import type {
  GamePlayerResponse,
  GuessResultResponse,
  PlayerGuessedEvent,
  RoundCountdownEvent,
  RoundEndedEvent,
  RoundStartedEvent,
} from "@/types/game-responses";

/** How long the round result screen stays visible before transitioning (ms) */
const ROUND_RESULT_DISPLAY_MS = 5000;
/** Shorter display when all players finished — enough to glance at scores */
const ROUND_RESULT_QUICK_MS = 4000;
/** Default round timer for rating guess (ms) */
const DEFAULT_ROUND_TIMER_MS = 10_000;
/** Fallback: any player triggers advancement this many ms after the round timer expires */
const ROUND_FALLBACK_BUFFER_MS = 3000;
/** After detecting all players finished client-side, wait before trying to advance */
const ALL_FINISHED_ADVANCE_MS = 2000;

function renderRatingGuessLabel(guessData: Record<string, unknown> | null): React.ReactNode {
  if (guessData === null) return null;
  const rating = guessData.guessedRating;
  if (typeof rating !== "number") return null;
  return rating.toFixed(1);
}

type RoundPhase = "guessing" | "result" | "finished";

interface MultiplayerGameProps {
  readonly gameId: string;
  readonly mediaOptions: unknown[];
  readonly onlineUserIds: Set<string>;
}

export function MultiplayerGame({ gameId, onlineUserIds }: MultiplayerGameProps) {
  const { user } = useAuth();
  const { data: game, mutate } = useGameState(gameId);
  const { submitGuess, isSubmitting } = useSubmitGuess();
  const { nextRound } = useNextRound();
  const { indicators, addIndicator, clearIndicators } = usePlayerGuessIndicators();

  const [roundPhase, setRoundPhase] = useState<RoundPhase>("guessing");
  const [roundResult, setRoundResult] = useState<GuessResultResponse | null>(null);
  const [startTimeForRound, setStartTimeForRound] = useState(getRoundStartTime);
  const [guessedAtProgress, setGuessedAtProgress] = useState<number | undefined>();
  const [playerOverrides, setPlayerOverrides] = useState<
    Map<string, { scoreAdded: number; roundsWonAdded: number }>
  >(new Map());
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [roundScores, setRoundScores] = useState<RoundEndedEvent["scores"] | null>(null);
  const [resultDisplaySeconds, setResultDisplaySeconds] = useState(ROUND_RESULT_DISPLAY_MS / 1000);
  const submittedRef = useRef(false);
  const advancingRef = useRef(false);
  const currentRatingRef = useRef(DEFAULT_RATING_VALUE);
  const roundStartDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timestamp when the result screen was shown — used to compute remaining delay for game-ended
  const resultShownAtRef = useRef(0);
  // Whether all players guessed this round — shorter result display when true
  const allGuessedRef = useRef(false);
  // Round fallback timer — fires after round timer + buffer to ensure advancement
  const roundFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Client-side all-finished detection — fires shortly after all players submitted
  const allFinishedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Game-ended fallback — re-fetches game state if game-ended event never arrives on last round
  const gameEndedFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Derive round timer from game settings (custom time limit or engine default)
  const roundTimerMs =
    game?.timeLimitSeconds !== undefined && game.timeLimitSeconds !== null
      ? game.timeLimitSeconds * 1000
      : DEFAULT_ROUND_TIMER_MS;
  // Auto-submit fallback for rAF-based timer (rAF stops in hidden/background tabs)
  const { setOnTimeExpired, startAutoSubmitTimer, clearAutoSubmitTimer } = useAutoSubmitTimer(
    roundTimerMs,
    startTimeForRound,
    mutate,
  );
  // Tracks which players have finished (correct guess or skip) via player-guessed events
  const finishedPlayersRef = useRef(new Set<string>());
  // Guards against stale/duplicate round-started events
  const handledRoundStartRef = useRef(-1);

  const channelName = `game:${gameId}`;

  const players = useMemo(() => {
    const basePlayers = game?.players ?? [];
    if (playerOverrides.size === 0) return basePlayers;
    return basePlayers.map((player: GamePlayerResponse) => {
      const override = playerOverrides.get(player.userId);
      if (override === undefined) return player;
      return {
        ...player,
        totalScore: player.totalScore + override.scoreAdded,
        roundsWon: player.roundsWon + override.roundsWonAdded,
      };
    });
  }, [game?.players, playerOverrides]);

  const currentRound = useMemo(() => {
    if (game === undefined) return null;
    return game.rounds.find((round) => round.roundNumber === game.currentRound) ?? null;
  }, [game]);

  // ── Game actions ──────────────────────────────────────────────

  const handleAdvanceRound = useCallback(async () => {
    const result = await nextRound(gameId);
    if (result === null) {
      advancingRef.current = false;
      setIsAdvancing(false);
    }
  }, [gameId, nextRound]);

  const handleNextRound = useCallback(async () => {
    if (!advancingRef.current) {
      advancingRef.current = true;
      setIsAdvancing(true);
      await handleAdvanceRound();
    }
  }, [handleAdvanceRound]);

  // ── Advance fallback timers ─────────────────────────────────
  // Any player can trigger advancement (server allows it for multiplayer).
  // Two layers of fallback cover different failure modes:
  // 1. All-finished detection: client-side tracking via player-guessed events (2s delay)
  // 2. Round fallback: fires after round timer + buffer (covers auto-submit failures)

  const tryAdvance = useCallback(() => {
    if (!advancingRef.current) {
      advancingRef.current = true;
      setIsAdvancing(true);
      void handleAdvanceRound();
    }
  }, [handleAdvanceRound]);

  const clearFallbackTimers = useCallback(() => {
    if (roundFallbackTimerRef.current !== null) {
      clearTimeout(roundFallbackTimerRef.current);
      roundFallbackTimerRef.current = null;
    }
    if (allFinishedTimerRef.current !== null) {
      clearTimeout(allFinishedTimerRef.current);
      allFinishedTimerRef.current = null;
    }
    clearAutoSubmitTimer();
  }, [clearAutoSubmitTimer]);

  const startRoundFallbackTimer = useCallback(() => {
    if (roundFallbackTimerRef.current !== null) {
      clearTimeout(roundFallbackTimerRef.current);
    }
    roundFallbackTimerRef.current = setTimeout(() => {
      roundFallbackTimerRef.current = null;
      tryAdvance();
    }, roundTimerMs + ROUND_FALLBACK_BUFFER_MS);
  }, [tryAdvance, roundTimerMs]);

  /** Check if all players have finished and schedule advancement if so. */
  const checkAllPlayersFinished = useCallback(() => {
    const totalPlayers = game?.players?.length ?? 0;
    if (totalPlayers === 0) return;
    if (finishedPlayersRef.current.size < totalPlayers) return;
    // All players done — use shorter result display
    allGuessedRef.current = true;
    // Schedule advance after short delay (gives server-side allGuessed a chance to fire first)
    if (allFinishedTimerRef.current !== null) return; // already scheduled
    allFinishedTimerRef.current = setTimeout(() => {
      allFinishedTimerRef.current = null;
      tryAdvance();
    }, ALL_FINISHED_ADVANCE_MS);
  }, [game?.players?.length, tryAdvance]);

  const handleGuess = useCallback(
    async (rating: number) => {
      if (currentRound === null || game === undefined || isSubmitting || submittedRef.current)
        return;
      submittedRef.current = true;

      const timeFromStartMs = Date.now() - startTimeForRound;

      const result = await submitGuess({
        gameId,
        roundId: currentRound.id,
        guessText: rating.toFixed(1),
        guessData: { guessedRating: rating },
        timeFromStartMs,
      });

      if (result === null) {
        submittedRef.current = false;
      } else {
        const resultData = result.resultData as unknown as RatingGuessResultData;
        playGuessSound(resultData.difference, result.isFirstCorrect === true);
        setRoundResult(result);
        setGuessedAtProgress(Math.min((Date.now() - startTimeForRound) / roundTimerMs, 1));
        // Track self as finished for client-side all-finished detection
        if (user?.id !== undefined) {
          finishedPlayersRef.current.add(user.id);
          checkAllPlayersFinished();
        }
      }
    },
    [
      checkAllPlayersFinished,
      currentRound,
      game,
      gameId,
      isSubmitting,
      roundTimerMs,
      startTimeForRound,
      submitGuess,
      user?.id,
    ],
  );

  const handleTimeExpired = useCallback(() => {
    if (!submittedRef.current) {
      void handleGuess(currentRatingRef.current);
    }
  }, [handleGuess]);
  setOnTimeExpired(handleTimeExpired);

  const handleRatingChange = useCallback((rating: number) => {
    currentRatingRef.current = rating;
  }, []);

  // Start fallback timers on mount (for the initial round)
  useEffect(() => {
    if (roundPhase === "guessing") {
      startRoundFallbackTimer();
      startAutoSubmitTimer();
    }
    // Only run on mount — subsequent rounds handled by round-started handler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize handledRoundStartRef once game data loads
  const gameCurrentRound = game?.currentRound;
  useEffect(() => {
    if (gameCurrentRound !== undefined && handledRoundStartRef.current === -1) {
      handledRoundStartRef.current = gameCurrentRound;
    }
  }, [gameCurrentRound]);

  // ── Ably event handlers ──────────────────────────────────────

  useChannel({ channelName }, "player-guessed", (message) => {
    const event = message.data as PlayerGuessedEvent;
    if (event.userId !== user?.id) {
      addIndicator(event);
    }

    // Track finished players for client-side all-finished detection
    if (event.isFinished) {
      finishedPlayersRef.current.add(event.userId);
      checkAllPlayersFinished();
    }

    setPlayerOverrides((previous) => {
      const next = new Map(previous);
      const existing = next.get(event.userId) ?? { scoreAdded: 0, roundsWonAdded: 0 };
      next.set(event.userId, {
        scoreAdded: existing.scoreAdded + event.scoreAwarded,
        roundsWonAdded: existing.roundsWonAdded + (event.isCorrect ? 1 : 0),
      });
      return next;
    });
  });

  useChannel({ channelName }, "round-countdown", (message) => {
    const event = message.data as RoundCountdownEvent;

    if (event.allGuessed) {
      allGuessedRef.current = true;
      // Don't clear fallback timers — they act as safety net if advance fails.
      // The round-ended handler clears them on successful transition.
      tryAdvance();
    }
  });

  useChannel({ channelName }, "round-ended", (message) => {
    const event = message.data as RoundEndedEvent;
    // Round successfully advanced — clear fallback timers
    clearFallbackTimers();

    if (roundResult === null) {
      const endedData = event.roundData;
      setRoundResult({
        isCorrect: false,
        scoreAwarded: 0,
        streakBonus: 0,
        currentStreak: 0,
        resultData: {
          correctRating: Number(endedData.correctRating ?? 0),
          guessedRating: 0,
          difference: Number(endedData.correctRating ?? 0),
        },
        roundScore: 0,
      });
    }

    setRoundScores(event.scores);
    setResultDisplaySeconds(
      allGuessedRef.current ? ROUND_RESULT_QUICK_MS / 1000 : ROUND_RESULT_DISPLAY_MS / 1000,
    );
    resultShownAtRef.current = Date.now();
    setRoundPhase("result");
    clearIndicators();

    // On the last round, start a fallback timer in case game-ended never arrives
    // (e.g. serverless function terminated before publishing the Ably event)
    const isLastRound = game !== undefined && game.currentRound + 1 >= game.roundCount;
    if (isLastRound) {
      gameEndedFallbackTimerRef.current = setTimeout(() => {
        gameEndedFallbackTimerRef.current = null;
        // Re-fetch game state — if status is "finished", the render check handles transition
        void mutate();
      }, 8000);
    }
  });

  useChannel({ channelName }, "round-started", (message) => {
    const event = message.data as RoundStartedEvent;
    // Guard against stale/duplicate round-started events
    if (event.roundNumber <= handledRoundStartRef.current) return;
    handledRoundStartRef.current = event.roundNumber;

    // Buffer the round transition so the result screen stays visible.
    // Shorter delay when all players finished (just a glance at scores).
    const delay = allGuessedRef.current ? ROUND_RESULT_QUICK_MS : ROUND_RESULT_DISPLAY_MS;
    if (roundStartDelayRef.current !== null) {
      clearTimeout(roundStartDelayRef.current);
    }
    roundStartDelayRef.current = setTimeout(() => {
      roundStartDelayRef.current = null;
      resultShownAtRef.current = 0;
      allGuessedRef.current = false;
      finishedPlayersRef.current = new Set();
      void mutate();
      playRoundStartSound();
      setRoundResult(null);
      setRoundScores(null);
      setStartTimeForRound(getRoundStartTime());
      setPlayerOverrides(new Map());
      submittedRef.current = false;
      advancingRef.current = false;
      setIsAdvancing(false);
      currentRatingRef.current = DEFAULT_RATING_VALUE;
      setGuessedAtProgress(undefined);
      setRoundPhase("guessing");
      clearIndicators();
      // Start timers for the new round
      startRoundFallbackTimer();
      startAutoSubmitTimer();
    }, delay);
  });

  useChannel({ channelName }, "game-ended", () => {
    // Game over — clear all fallback timers
    clearFallbackTimers();
    if (gameEndedFallbackTimerRef.current !== null) {
      clearTimeout(gameEndedFallbackTimerRef.current);
      gameEndedFallbackTimerRef.current = null;
    }
    const displayMs = allGuessedRef.current ? ROUND_RESULT_QUICK_MS : ROUND_RESULT_DISPLAY_MS;

    const processGameEnded = () => {
      resultShownAtRef.current = 0;
      allGuessedRef.current = false;
      void mutate();
      playGameEndSound();
      setRoundPhase("finished");
      clearIndicators();
      if (roundStartDelayRef.current !== null) {
        clearTimeout(roundStartDelayRef.current);
        roundStartDelayRef.current = null;
      }
    };

    // If showing a result screen, delay so players can see last round scores
    if (resultShownAtRef.current > 0) {
      const elapsed = Date.now() - resultShownAtRef.current;
      const remaining = Math.max(0, displayMs - elapsed);

      if (remaining > 0) {
        if (roundStartDelayRef.current !== null) {
          clearTimeout(roundStartDelayRef.current);
        }
        roundStartDelayRef.current = setTimeout(processGameEnded, remaining);
        return;
      }
    }

    processGameEnded();
  });

  useEffect(() => {
    return () => {
      if (roundStartDelayRef.current !== null) {
        clearTimeout(roundStartDelayRef.current);
      }
      if (roundFallbackTimerRef.current !== null) {
        clearTimeout(roundFallbackTimerRef.current);
      }
      if (allFinishedTimerRef.current !== null) {
        clearTimeout(allFinishedTimerRef.current);
      }
      if (gameEndedFallbackTimerRef.current !== null) {
        clearTimeout(gameEndedFallbackTimerRef.current);
      }
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────

  if (game === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading game...</div>
      </div>
    );
  }

  if (roundPhase === "finished" || game.status === "finished") {
    return null;
  }

  if (roundPhase === "result" && roundResult !== null) {
    const resultData = roundResult.resultData as unknown as RatingGuessResultData;
    const roundData = currentRound?.roundData as unknown as RatingGuessRoundData | undefined;
    const header = getRatingResultHeader(resultData.difference);

    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col items-center gap-4">
          <ScoreHeader
            totalScore={game.totalScore + roundResult.scoreAwarded}
            baseScore={roundResult.roundScore}
            streakBonus={roundResult.streakBonus}
          />
          <RoundResult
            result={roundResult}
            roundNumber={game.currentRound}
            totalRounds={game.roundCount}
            onNextRound={() => {
              void handleNextRound();
            }}
            isAdvancing={isAdvancing}
            isLastRound={game.currentRound + 1 >= game.roundCount}
            isMultiplayer
            roundScores={roundScores ?? undefined}
            autoAdvanceSeconds={resultDisplaySeconds}
            hideScoreBreakdown
            showFirstCorrect={false}
            renderGuessLabel={renderRatingGuessLabel}
            resultHeader={
              <div className="flex flex-col items-center gap-2">
                <span
                  className={`flex size-14 items-center justify-center rounded-full bg-current/16 ${header.colorClass}`}
                >
                  <header.icon className="size-7" />
                </span>
                <h2 className={`font-display text-[26px] font-semibold ${header.colorClass}`}>
                  {header.text}
                </h2>
              </div>
            }
            answerDisplay={
              <RatingAnswerDisplay
                resultData={resultData}
                posterUrl={roundData?.posterUrl ?? ""}
                title={roundData?.title ?? "Unknown"}
              />
            }
          />
        </div>
        <div className="hidden lg:block">
          <LiveScoreboard players={players} onlineUserIds={onlineUserIds} />
        </div>
      </div>
    );
  }

  const roundData = currentRound?.roundData as unknown as RatingGuessRoundData | undefined;
  if (roundData?.posterUrl === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Preparing round...</div>
      </div>
    );
  }

  const hasSubmitted = roundResult !== null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col items-center gap-6">
        <ScoreHeader
          totalScore={game.totalScore}
          roundLabel={`Round ${String(game.currentRound + 1)}/${String(game.roundCount)}`}
        />

        <RatingGuessVisual
          key={game.currentRound}
          posterUrl={roundData.posterUrl}
          title={roundData.title}
          ratingCount={roundData.ratingCount}
          totalDuration={roundTimerMs}
          onTimeExpired={handleTimeExpired}
          guessedAtProgress={guessedAtProgress}
        />

        {hasSubmitted ? (
          <SubmittedBanner
            guessedRating={
              (roundResult.resultData as unknown as RatingGuessResultData).guessedRating
            }
            score={roundResult.scoreAwarded}
          />
        ) : (
          <RatingInput
            key={`input-${String(game.currentRound)}`}
            onSubmit={(rating) => {
              void handleGuess(rating);
            }}
            onValueChange={handleRatingChange}
            disabled={isSubmitting}
          />
        )}
      </div>

      <div className="hidden lg:block">
        <LiveScoreboard players={players} onlineUserIds={onlineUserIds} />
      </div>

      <PlayerGuessIndicators indicators={indicators} />
    </div>
  );
}

function playGuessSound(difference: number, isFirstCorrect: boolean): void {
  if (isFirstCorrect) {
    playFirstCorrectSound();
    return;
  }
  if (difference < 1) {
    playCloseGuessSound();
  } else if (difference < 3) {
    playCorrectSound();
  } else {
    playWrongSound();
  }
}
