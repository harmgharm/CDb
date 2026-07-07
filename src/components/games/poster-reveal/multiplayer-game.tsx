"use client";

/**
 * MultiplayerGame — Orchestrates the multiplayer game flow
 *
 * Driven by Ably events: round-started, player-guessed, round-countdown,
 * round-ended, game-ended. The host's client triggers round advancement
 * when the countdown expires.
 */

import { useChannel } from "ably/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LiveScoreboard } from "@/components/games/live-scoreboard";
import {
  CorrectGuessBanner,
  ScoreHeader,
  WrongGuessBanner,
} from "@/components/games/multiplayer-banners";
import {
  PlayerGuessIndicators,
  usePlayerGuessIndicators,
} from "@/components/games/player-guess-indicator";
import { GuessInput } from "@/components/games/poster-reveal/guess-input";
import {
  getRoundStartTime,
  PosterReveal,
} from "@/components/games/poster-reveal/poster-reveal-visual";
import { RoundResult } from "@/components/games/round-result";
import { useAuth } from "@/components/providers/auth-provider";
import { useAutoSubmitTimer } from "@/hooks/use-auto-submit-timer";
import { useGameState, useNextRound, useSubmitGuess } from "@/hooks/use-games";
import {
  playCorrectSound,
  playFirstCorrectSound,
  playGameEndSound,
  playRoundStartSound,
  playSkipSound,
  playWrongSound,
} from "@/lib/games/sounds";
import type {
  GuessResultResponse,
  PlayerGuessedEvent,
  RoundCountdownEvent,
  RoundEndedEvent,
  RoundStartedEvent,
} from "@/types/game-responses";
import type { MediaListItem } from "@/types/media-responses";

/** How long the round result screen stays visible before transitioning (ms) */
const ROUND_RESULT_DISPLAY_MS = 5000;
/** Shorter display when all players finished — enough to glance at scores */
const ROUND_RESULT_QUICK_MS = 3000;
/** Total round timer (10s reveal + 5s grace) — must match poster-reveal-visual */
const ROUND_TIMER_MS = 15_000;
/** Fallback: any player triggers advancement this many ms after the round timer expires */
const ROUND_FALLBACK_BUFFER_MS = 3000;
/** After detecting all players finished client-side, wait before trying to advance */
const ALL_FINISHED_ADVANCE_MS = 2000;

type RoundPhase = "guessing" | "result" | "finished";

interface MultiplayerGameProps {
  readonly gameId: string;
  readonly mediaOptions: MediaListItem[];
  readonly onlineUserIds: Set<string>;
}

export function MultiplayerGame({ gameId, mediaOptions, onlineUserIds }: MultiplayerGameProps) {
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
  const [wrongGuessFlash, setWrongGuessFlash] = useState(false);
  const [roundScores, setRoundScores] = useState<RoundEndedEvent["scores"] | null>(null);
  const [resultDisplaySeconds, setResultDisplaySeconds] = useState(ROUND_RESULT_DISPLAY_MS / 1000);
  const submittedRef = useRef(false);
  const advancingRef = useRef(false);
  const wrongFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the poster reveal timer has expired — used to handle the race
  // condition where a wrong guess is in-flight when the timer fires.
  const timeExpiredRef = useRef(false);
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
  // Auto-submit fallback for rAF-based timer (rAF stops in hidden/background tabs)
  const { setOnTimeExpired, startAutoSubmitTimer, clearAutoSubmitTimer } = useAutoSubmitTimer(
    ROUND_TIMER_MS,
    startTimeForRound,
    mutate,
  );
  // Tracks which players have finished (correct guess or skip) via player-guessed events
  const finishedPlayersRef = useRef(new Set<string>());
  // Guards against stale/duplicate round-started events
  const handledRoundStartRef = useRef(-1);

  const channelName = `game:${gameId}`;

  // Derive players from SWR data + real-time overrides
  const players = useMemo(() => {
    const basePlayers = game?.players ?? [];
    if (playerOverrides.size === 0) return basePlayers;
    return basePlayers.map((player) => {
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

  // ── Advance fallback timers ─────────────────────────────────
  // Any player can trigger advancement (server allows it for multiplayer).
  // Two layers of fallback cover different failure modes:
  // 1. All-finished detection: client-side tracking via player-guessed events (2s delay)
  // 2. Round fallback: fires after round timer + buffer (covers auto-submit failures)

  const handleAdvanceRound = useCallback(async () => {
    const result = await nextRound(gameId);
    if (result === null) {
      advancingRef.current = false;
      setIsAdvancing(false);
    }
  }, [gameId, nextRound]);

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
    }, ROUND_TIMER_MS + ROUND_FALLBACK_BUFFER_MS);
  }, [tryAdvance]);

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

  // ── Game actions ──────────────────────────────────────────────

  const handleSkip = useCallback(async () => {
    if (currentRound === null || game === undefined || submittedRef.current) return;
    submittedRef.current = true;
    playSkipSound();

    const timeFromStartMs = Date.now() - startTimeForRound;

    const result = await submitGuess({
      gameId,
      roundId: currentRound.id,
      guessText: "(skipped)",
      timeFromStartMs,
    });

    if (result === null) {
      // Reset on failure so the fallback timer can retry
      submittedRef.current = false;
    } else {
      setGuessedAtProgress(Math.min((Date.now() - startTimeForRound) / ROUND_TIMER_MS, 1));
      // Track self as finished for client-side all-finished detection
      if (user?.id !== undefined) {
        finishedPlayersRef.current.add(user.id);
        checkAllPlayersFinished();
      }
    }
  }, [
    checkAllPlayersFinished,
    currentRound,
    game,
    gameId,
    startTimeForRound,
    submitGuess,
    user?.id,
  ]);

  const showWrongFlash = useCallback(() => {
    setWrongGuessFlash(true);
    if (wrongFlashTimerRef.current !== null) {
      clearTimeout(wrongFlashTimerRef.current);
    }
    wrongFlashTimerRef.current = setTimeout(() => {
      setWrongGuessFlash(false);
      wrongFlashTimerRef.current = null;
    }, 1500);
  }, []);

  const handleGuess = useCallback(
    async (title: string, mediaId?: string) => {
      if (currentRound === null || game === undefined || isSubmitting || submittedRef.current)
        return;
      submittedRef.current = true;

      const timeFromStartMs = Date.now() - startTimeForRound;

      const result = await submitGuess({
        gameId,
        roundId: currentRound.id,
        guessText: title,
        mediaId,
        timeFromStartMs,
      });

      if (result === null) {
        submittedRef.current = false;
        return;
      }

      if (result.isCorrect) {
        if (result.isFirstCorrect === true) {
          playFirstCorrectSound();
        } else {
          playCorrectSound();
        }
      } else {
        playWrongSound();
        showWrongFlash();
      }

      setRoundResult(result);

      if (result.isCorrect) {
        setGuessedAtProgress(Math.min((Date.now() - startTimeForRound) / ROUND_TIMER_MS, 1));
        // Track self as finished for client-side all-finished detection
        if (user?.id !== undefined) {
          finishedPlayersRef.current.add(user.id);
          checkAllPlayersFinished();
        }
      } else {
        submittedRef.current = false;
        // If the poster reveal timer already expired while this guess was in-flight,
        // auto-skip now to prevent the round from freezing.
        if (timeExpiredRef.current) {
          void handleSkip();
        }
      }
    },
    [
      currentRound,
      game,
      gameId,
      handleSkip,
      checkAllPlayersFinished,
      isSubmitting,
      showWrongFlash,
      startTimeForRound,
      submitGuess,
      user?.id,
    ],
  );

  const handleTimeExpired = useCallback(() => {
    timeExpiredRef.current = true;
    if (!submittedRef.current) {
      playSkipSound();
      void handleSkip();
    }
    // If submittedRef.current is true (guess in-flight), the handleGuess callback
    // will check timeExpiredRef and auto-skip once the response arrives.
  }, [handleSkip]);
  setOnTimeExpired(handleTimeExpired);

  const handleNextRound = useCallback(async () => {
    if (!advancingRef.current) {
      advancingRef.current = true;
      setIsAdvancing(true);
      await handleAdvanceRound();
    }
  }, [handleAdvanceRound]);

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
      const endedData = event.roundData as Record<string, string>;
      setRoundResult({
        isCorrect: false,
        scoreAwarded: 0,
        streakBonus: 0,
        currentStreak: 0,
        resultData: {
          correctTitle: endedData.title ?? "",
          correctPosterUrl: endedData.posterUrl ?? "",
        },
        roundScore: 0,
      });
    }

    setWrongGuessFlash(false);
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
      timeExpiredRef.current = false;
      setIsAdvancing(false);
      setGuessedAtProgress(undefined);
      setRoundPhase("guessing");
      setWrongGuessFlash(false);
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

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (wrongFlashTimerRef.current !== null) {
        clearTimeout(wrongFlashTimerRef.current);
      }
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
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col items-center gap-4">
          <ScoreHeader totalScore={game.totalScore + roundResult.scoreAwarded} />
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
          />
        </div>
        <div className="hidden lg:block">
          <LiveScoreboard players={players} onlineUserIds={onlineUserIds} />
        </div>
      </div>
    );
  }

  const multiPosterUrl = (currentRound?.roundData as Record<string, string> | undefined)?.posterUrl;
  if (multiPosterUrl == null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Preparing round...</div>
      </div>
    );
  }

  const hasGuessedCorrectly = roundResult?.isCorrect === true;
  const correctScore = roundResult === null ? 0 : roundResult.scoreAwarded;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col items-center gap-6">
        <ScoreHeader
          totalScore={game.totalScore}
          roundLabel={`Round ${String(game.currentRound + 1)}/${String(game.roundCount)}`}
        />

        <PosterReveal
          posterUrl={multiPosterUrl}
          onTimeExpired={handleTimeExpired}
          isPaused={hasGuessedCorrectly}
          guessedAtProgress={guessedAtProgress}
        />

        {hasGuessedCorrectly ? (
          <CorrectGuessBanner score={correctScore} />
        ) : (
          <>
            {wrongGuessFlash && <WrongGuessBanner />}

            <GuessInput
              key={game.currentRound}
              mediaOptions={mediaOptions}
              onGuess={(title, mediaId) => {
                void handleGuess(title, mediaId);
              }}
              disabled={isSubmitting}
              placeholder="Type a title and press Enter..."
            />
          </>
        )}
      </div>

      <div className="hidden lg:block">
        <LiveScoreboard players={players} onlineUserIds={onlineUserIds} />
      </div>

      <PlayerGuessIndicators indicators={indicators} />
    </div>
  );
}
