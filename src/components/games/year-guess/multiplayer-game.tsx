"use client";

/**
 * MultiplayerGame — Orchestrates the multiplayer Year Guesser flow
 *
 * Driven by Ably events: round-started, player-guessed, round-countdown,
 * round-ended, game-ended. The host's client triggers round advancement
 * when the countdown expires.
 */

import { useChannel } from "ably/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LiveScoreboard } from "@/components/games/live-scoreboard";
import { ScoreHeader } from "@/components/games/multiplayer-banners";
import {
  PlayerGuessIndicators,
  usePlayerGuessIndicators,
} from "@/components/games/player-guess-indicator";
import { RoundResult } from "@/components/games/round-result";
import {
  getYearResultHeader,
  YearAnswerDisplay,
} from "@/components/games/year-guess/year-answer-display";
import {
  getRoundStartTime,
  YearGuessVisual,
} from "@/components/games/year-guess/year-guess-visual";
import { DEFAULT_YEAR_VALUE, YearInput } from "@/components/games/year-guess/year-input";
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
import type { YearGuessResultData, YearGuessRoundData } from "@/types/game-engine-data";
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
/** Default round timer for year guess (ms) */
const DEFAULT_ROUND_TIMER_MS = 10_000;
/** Fallback: any player triggers advancement this many ms after the round timer expires */
const ROUND_FALLBACK_BUFFER_MS = 3000;
/** After detecting all players finished client-side, wait before trying to advance */
const ALL_FINISHED_ADVANCE_MS = 2000;

function renderYearGuessLabel(guessData: Record<string, unknown> | null): React.ReactNode {
  if (guessData === null) return null;
  const year = guessData.guessedYear;
  if (typeof year !== "number") return null;
  return String(year);
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
  const currentYearRef = useRef(DEFAULT_YEAR_VALUE);
  const roundStartDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultShownAtRef = useRef(0);
  const allGuessedRef = useRef(false);
  const roundFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allFinishedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameEndedFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundTimerMs =
    game?.timeLimitSeconds !== undefined && game.timeLimitSeconds !== null
      ? game.timeLimitSeconds * 1000
      : DEFAULT_ROUND_TIMER_MS;
  const { setOnTimeExpired, startAutoSubmitTimer, clearAutoSubmitTimer } = useAutoSubmitTimer(
    roundTimerMs,
    startTimeForRound,
    mutate,
  );
  const finishedPlayersRef = useRef(new Set<string>());
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

  const checkAllPlayersFinished = useCallback(() => {
    const totalPlayers = game?.players?.length ?? 0;
    if (totalPlayers === 0) return;
    if (finishedPlayersRef.current.size < totalPlayers) return;
    allGuessedRef.current = true;
    if (allFinishedTimerRef.current !== null) return;
    allFinishedTimerRef.current = setTimeout(() => {
      allFinishedTimerRef.current = null;
      tryAdvance();
    }, ALL_FINISHED_ADVANCE_MS);
  }, [game?.players?.length, tryAdvance]);

  const handleGuess = useCallback(
    async (year: number) => {
      if (currentRound === null || game === undefined || isSubmitting || submittedRef.current)
        return;
      submittedRef.current = true;

      const timeFromStartMs = Date.now() - startTimeForRound;

      const result = await submitGuess({
        gameId,
        roundId: currentRound.id,
        guessText: String(year),
        guessData: { guessedYear: year },
        timeFromStartMs,
      });

      if (result === null) {
        submittedRef.current = false;
      } else {
        const resultData = result.resultData as unknown as YearGuessResultData;
        playGuessSound(resultData.difference, result.isFirstCorrect === true);
        setRoundResult(result);
        setGuessedAtProgress(Math.min((Date.now() - startTimeForRound) / roundTimerMs, 1));
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
      void handleGuess(currentYearRef.current);
    }
  }, [handleGuess]);
  setOnTimeExpired(handleTimeExpired);

  const handleYearChange = useCallback((year: number) => {
    currentYearRef.current = year;
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
      tryAdvance();
    }
  });

  useChannel({ channelName }, "round-ended", (message) => {
    const event = message.data as RoundEndedEvent;
    clearFallbackTimers();

    if (roundResult === null) {
      const endedData = event.roundData;
      setRoundResult({
        isCorrect: false,
        scoreAwarded: 0,
        streakBonus: 0,
        currentStreak: 0,
        resultData: {
          correctYear: Number(endedData.correctYear ?? 2000),
          guessedYear: 2000,
          difference: Math.abs(2000 - Number(endedData.correctYear ?? 2000)),
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

    const isLastRound = game !== undefined && game.currentRound + 1 >= game.roundCount;
    if (isLastRound) {
      gameEndedFallbackTimerRef.current = setTimeout(() => {
        gameEndedFallbackTimerRef.current = null;
        void mutate();
      }, 8000);
    }
  });

  useChannel({ channelName }, "round-started", (message) => {
    const event = message.data as RoundStartedEvent;
    if (event.roundNumber <= handledRoundStartRef.current) return;
    handledRoundStartRef.current = event.roundNumber;

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
      currentYearRef.current = DEFAULT_YEAR_VALUE;
      setGuessedAtProgress(undefined);
      setRoundPhase("guessing");
      clearIndicators();
      startRoundFallbackTimer();
      startAutoSubmitTimer();
    }, delay);
  });

  useChannel({ channelName }, "game-ended", () => {
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
    const resultData = roundResult.resultData as unknown as YearGuessResultData;
    const roundData = currentRound?.roundData as unknown as YearGuessRoundData | undefined;
    const header = getYearResultHeader(resultData.difference);

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
            renderGuessLabel={renderYearGuessLabel}
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
              <YearAnswerDisplay
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

  const roundData = currentRound?.roundData as unknown as YearGuessRoundData | undefined;
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

        <YearGuessVisual
          key={game.currentRound}
          posterUrl={roundData.posterUrl}
          title={roundData.title}
          totalDuration={roundTimerMs}
          onTimeExpired={handleTimeExpired}
          guessedAtProgress={guessedAtProgress}
        />

        {hasSubmitted ? (
          <SubmittedYearBanner
            guessedYear={(roundResult.resultData as unknown as YearGuessResultData).guessedYear}
            score={roundResult.scoreAwarded}
          />
        ) : (
          <YearInput
            key={`input-${String(game.currentRound)}`}
            onSubmit={(year) => {
              void handleGuess(year);
            }}
            onValueChange={handleYearChange}
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

function SubmittedYearBanner({
  guessedYear,
  score,
}: Readonly<{ guessedYear: number; score: number }>) {
  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-6 py-3 text-center">
      <p className="font-medium text-blue-400">
        Submitted: {String(guessedYear)} — +{String(score)} pts
      </p>
      <p className="text-muted-foreground mt-1 text-xs">Waiting for other players...</p>
    </div>
  );
}

function playGuessSound(difference: number, isFirstCorrect: boolean): void {
  if (isFirstCorrect) {
    playFirstCorrectSound();
    return;
  }
  if (difference <= 1) {
    playCloseGuessSound();
  } else if (difference <= 5) {
    playCorrectSound();
  } else {
    playWrongSound();
  }
}
