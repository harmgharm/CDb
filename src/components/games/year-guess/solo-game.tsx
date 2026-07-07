"use client";

/**
 * SoloGame — Orchestrates the singleplayer Year Guesser flow
 *
 * Flow: see media → guess year → round result → next round → ... → game result
 */

import { useCallback, useMemo, useRef, useState } from "react";

import { GameResult } from "@/components/games/game-result";
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
import { useGameState, useNextRound, useSubmitGuess } from "@/hooks/use-games";
import {
  playCloseGuessSound,
  playCorrectSound,
  playGameEndSound,
  playRoundStartSound,
  playWrongSound,
} from "@/lib/games/sounds";
import type { YearGuessResultData, YearGuessRoundData } from "@/types/game-engine-data";
import type { GuessResultResponse } from "@/types/game-responses";

type RoundPhase = "guessing" | "result" | "finished";

interface SoloGameProps {
  readonly gameId: string;
  readonly onPlayAgain: () => void;
}

export function SoloGame({ gameId, onPlayAgain }: SoloGameProps) {
  const { data: game, mutate } = useGameState(gameId);
  const { submitGuess, isSubmitting } = useSubmitGuess();
  const { nextRound, isAdvancing } = useNextRound();

  const [roundPhase, setRoundPhase] = useState<RoundPhase>("guessing");
  const [roundResult, setRoundResult] = useState<GuessResultResponse | null>(null);
  const [isNewPersonalBest, setIsNewPersonalBest] = useState(false);
  const [roundStartTime] = useState(getRoundStartTime);
  const [startTimeForRound, setStartTimeForRound] = useState(roundStartTime);
  const submittedRef = useRef(false);
  // Track current slider value for auto-submit on time expiry
  const currentYearRef = useRef(DEFAULT_YEAR_VALUE);

  const currentRound = useMemo(() => {
    if (game === undefined) return null;
    return game.rounds.find((round) => round.roundNumber === game.currentRound) ?? null;
  }, [game]);

  // Derive round timer from game settings (custom time limit or visual default)
  const roundTimerMs =
    game?.timeLimitSeconds !== undefined && game.timeLimitSeconds !== null
      ? game.timeLimitSeconds * 1000
      : undefined;

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
        playGuessSound(resultData.difference);
        setRoundResult(result);
        setRoundPhase("result");
      }
    },
    [currentRound, game, gameId, isSubmitting, startTimeForRound, submitGuess],
  );

  const handleTimeExpired = useCallback(() => {
    void handleGuess(currentYearRef.current);
  }, [handleGuess]);

  const handleYearChange = useCallback((year: number) => {
    currentYearRef.current = year;
  }, []);

  const handleNextRound = useCallback(async () => {
    const result = await nextRound(gameId);
    if (result === null) return;

    if (result.finished) {
      await mutate();
      playGameEndSound();
      setIsNewPersonalBest(result.isNewPersonalBest);
      setRoundPhase("finished");
    } else {
      await mutate();
      playRoundStartSound();
      setRoundResult(null);
      setStartTimeForRound(getRoundStartTime());
      submittedRef.current = false;
      currentYearRef.current = DEFAULT_YEAR_VALUE;
      setRoundPhase("guessing");
    }
  }, [gameId, mutate, nextRound]);

  if (game === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading game...</div>
      </div>
    );
  }

  // Game finished
  if (roundPhase === "finished" || game.status === "finished") {
    return (
      <GameResult
        game={game}
        onPlayAgain={onPlayAgain}
        isNewPersonalBest={isNewPersonalBest}
        renderRoundAnswer={(roundData) => {
          const data = roundData as unknown as YearGuessRoundData;
          return (
            <>
              {data.title}
              <span className="text-muted-foreground ml-2 text-xs">
                ({String(data.correctYear)})
              </span>
            </>
          );
        }}
      />
    );
  }

  // Between rounds — show result
  if (roundPhase === "result" && roundResult !== null) {
    const resultData = roundResult.resultData as unknown as YearGuessResultData;
    const roundData = currentRound?.roundData as unknown as YearGuessRoundData | undefined;
    const header = getYearResultHeader(resultData.difference);

    return (
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
          hideScoreBreakdown
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
    );
  }

  // Active round — show media + year input
  const roundData = currentRound?.roundData as unknown as YearGuessRoundData | undefined;
  if (roundData?.posterUrl === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Preparing round...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <ScoreHeader totalScore={game.totalScore} />

      {/* Round info */}
      <p className="text-muted-foreground text-sm">
        Round {String(game.currentRound + 1)} of {String(game.roundCount)}
      </p>

      {/* Media display + timer */}
      <YearGuessVisual
        key={game.currentRound}
        posterUrl={roundData.posterUrl}
        title={roundData.title}
        totalDuration={roundTimerMs}
        onTimeExpired={handleTimeExpired}
        isPaused={roundPhase !== "guessing"}
      />

      {/* Year input */}
      <YearInput
        key={`input-${String(game.currentRound)}`}
        onSubmit={(year) => {
          void handleGuess(year);
        }}
        onValueChange={handleYearChange}
        disabled={isSubmitting}
      />
    </div>
  );
}

function ScoreHeader({
  totalScore,
  baseScore,
  streakBonus,
}: Readonly<{ totalScore: number; baseScore?: number; streakBonus?: number }>) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
        Score
      </p>
      <p className="font-display text-[40px] leading-none">{String(totalScore)}</p>
      {baseScore !== undefined && (
        <div className="text-muted-foreground flex items-center justify-center gap-3 text-sm">
          <span>Base: {String(baseScore)}</span>
          {streakBonus !== undefined && streakBonus > 0 && (
            <span className="text-cdb-warning">Streak: +{String(streakBonus)}</span>
          )}
        </div>
      )}
    </div>
  );
}

function playGuessSound(difference: number): void {
  if (difference <= 1) {
    playCloseGuessSound();
  } else if (difference <= 5) {
    playCorrectSound();
  } else {
    playWrongSound();
  }
}
