"use client";

/**
 * RoundResult — Shown between rounds with score and answer details
 */

import { CheckCircleIcon, FlameIcon, XCircleIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import type { PosterRevealResultData } from "@/types/game-engine-data";
import type { GuessResultResponse } from "@/types/game-responses";

interface RoundResultProps {
  readonly result: GuessResultResponse;
  readonly roundNumber: number;
  readonly totalRounds: number;
  readonly onNextRound: () => void;
  readonly isAdvancing: boolean;
  readonly isLastRound: boolean;
  /** Game-specific answer display (replaces default poster thumbnail) */
  readonly answerDisplay?: React.ReactNode;
  /** Game-specific header (replaces default "Correct!" / "Wrong!") */
  readonly resultHeader?: React.ReactNode;
}

export function RoundResult({
  result,
  roundNumber,
  totalRounds,
  onNextRound,
  isAdvancing,
  isLastRound,
  answerDisplay,
  resultHeader,
}: RoundResultProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
      className="flex flex-col items-center gap-6"
    >
      {/* Correct / Wrong indicator */}
      {resultHeader ?? (
        <div className="flex flex-col items-center gap-2">
          {result.isCorrect ? (
            <CheckCircleIcon className="size-12 text-green-500" />
          ) : (
            <XCircleIcon className="size-12 text-red-500" />
          )}
          <h2 className="text-2xl font-bold">{result.isCorrect ? "Correct!" : "Wrong!"}</h2>
        </div>
      )}

      {/* Answer reveal */}
      {answerDisplay ?? (
        <DefaultAnswerDisplay result={result} roundNumber={roundNumber} totalRounds={totalRounds} />
      )}

      {/* Score breakdown */}
      {result.isCorrect && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.3, ease: "easeOut" as const }}
          className="flex flex-col items-center gap-1"
        >
          <p className="text-3xl font-bold tabular-nums">+{String(result.scoreAwarded)}</p>
          <div className="text-muted-foreground flex items-center gap-3 text-sm">
            <span>Base: {String(result.roundScore)}</span>
            {result.streakBonus > 0 && (
              <span className="text-orange-400">Streak: +{String(result.streakBonus)}</span>
            )}
          </div>
        </motion.div>
      )}

      {/* Streak display */}
      {result.currentStreak >= 2 && (
        <div className="flex items-center gap-1 text-orange-400">
          <FlameIcon className="size-5" />
          <span className="text-sm font-medium">{String(result.currentStreak)} streak!</span>
        </div>
      )}

      {/* Next round button */}
      <Button onClick={onNextRound} disabled={isAdvancing} size="lg" className="mt-2">
        {isLastRound ? "View Results" : "Next Round"}
      </Button>
    </motion.div>
  );
}

function DefaultAnswerDisplay({
  result,
  roundNumber,
  totalRounds,
}: Readonly<{ result: GuessResultResponse; roundNumber: number; totalRounds: number }>) {
  const data = result.resultData as unknown as PosterRevealResultData;
  const posterUrl = data.correctPosterUrl;
  const title = data.correctTitle;

  return (
    <div className="flex items-center gap-4">
      {posterUrl.length > 0 && (
        <div className="relative aspect-[2/3] w-20 overflow-hidden rounded-md shadow-lg">
          <Image
            src={posterUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="80px"
            unoptimized
          />
        </div>
      )}
      <div>
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-muted-foreground text-sm">
          Round {String(roundNumber + 1)} of {String(totalRounds)}
        </p>
      </div>
    </div>
  );
}
