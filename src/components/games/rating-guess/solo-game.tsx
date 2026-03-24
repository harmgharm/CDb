"use client";

/**
 * SoloGame — Orchestrates the singleplayer Rating Guesser flow
 *
 * Flow: see media → guess rating → round result → next round → ... → game result
 */

import { useCallback, useMemo, useRef, useState } from "react";

import { GameResult } from "@/components/games/game-result";
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
import { useGameState, useNextRound, useSubmitGuess } from "@/hooks/use-games";
import {
  playCloseGuessSound,
  playCorrectSound,
  playGameEndSound,
  playRoundStartSound,
  playWrongSound,
} from "@/lib/games/sounds";
import type { RatingGuessResultData, RatingGuessRoundData } from "@/types/game-engine-data";
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
  const currentRatingRef = useRef(DEFAULT_RATING_VALUE);

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
        playGuessSound(resultData.difference);
        setRoundResult(result);
        setRoundPhase("result");
      }
    },
    [currentRound, game, gameId, isSubmitting, startTimeForRound, submitGuess],
  );

  const handleTimeExpired = useCallback(() => {
    void handleGuess(currentRatingRef.current);
  }, [handleGuess]);

  const handleRatingChange = useCallback((rating: number) => {
    currentRatingRef.current = rating;
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
      currentRatingRef.current = DEFAULT_RATING_VALUE;
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
          const data = roundData as unknown as RatingGuessRoundData;
          return (
            <>
              {data.title}
              <span className="text-muted-foreground ml-2 text-xs">
                ({data.correctRating.toFixed(1)})
              </span>
            </>
          );
        }}
      />
    );
  }

  // Between rounds — show result
  if (roundPhase === "result" && roundResult !== null) {
    const resultData = roundResult.resultData as unknown as RatingGuessResultData;
    const roundData = currentRound?.roundData as unknown as RatingGuessRoundData | undefined;
    const header = getRatingResultHeader(resultData.difference);

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
              <span className="text-4xl">{header.icon}</span>
              <h2 className={`text-2xl font-bold ${header.colorClass}`}>{header.text}</h2>
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
    );
  }

  // Active round — show media + rating input
  const roundData = currentRound?.roundData as unknown as RatingGuessRoundData | undefined;
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
      <RatingGuessVisual
        key={game.currentRound}
        posterUrl={roundData.posterUrl}
        title={roundData.title}
        ratingCount={roundData.ratingCount}
        totalDuration={roundTimerMs}
        onTimeExpired={handleTimeExpired}
        isPaused={roundPhase !== "guessing"}
      />

      {/* Rating input */}
      <RatingInput
        key={`input-${String(game.currentRound)}`}
        onSubmit={(rating) => {
          void handleGuess(rating);
        }}
        onValueChange={handleRatingChange}
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
      <p className="text-muted-foreground text-xs tracking-wider uppercase">Score</p>
      <p className="text-3xl font-bold tabular-nums">{String(totalScore)}</p>
      {baseScore !== undefined && (
        <div className="text-muted-foreground flex items-center justify-center gap-3 text-sm">
          <span>Base: {String(baseScore)}</span>
          {streakBonus !== undefined && streakBonus > 0 && (
            <span className="text-orange-400">Streak: +{String(streakBonus)}</span>
          )}
        </div>
      )}
    </div>
  );
}

function playGuessSound(difference: number): void {
  if (difference < 1) {
    playCloseGuessSound();
  } else if (difference < 3) {
    playCorrectSound();
  } else {
    playWrongSound();
  }
}
