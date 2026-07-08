"use client";

/**
 * GameResult — End-of-game summary with scores and round breakdown
 */

import {
  ClockIcon,
  FlameIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  SparklesIcon,
  TargetIcon,
  TrophyIcon,
} from "lucide-react";
import * as motion from "motion/react-client";

import { GameBackButton } from "@/components/games/game-back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GameSessionResponse } from "@/types/game-responses";

interface GameResultProps {
  readonly game: GameSessionResponse;
  readonly onPlayAgain: () => void;
  readonly isNewPersonalBest?: boolean;
  /** Optional custom renderer for round answers in the breakdown */
  readonly renderRoundAnswer?: (roundData: Record<string, unknown>) => React.ReactNode;
}

export function GameResult({
  game,
  onPlayAgain,
  isNewPersonalBest = false,
  renderRoundAnswer,
}: GameResultProps) {
  // Aggregate stats from round guesses
  let correctCount = 0;
  let bestStreak = 0;
  let currentStreak = 0;
  let totalTime = 0;
  let correctTimeCount = 0;

  for (const round of game.rounds) {
    const guess = round.guesses[0]; // Solo: one guess per round
    if (guess !== undefined) {
      if (guess.isCorrect) {
        correctCount += 1;
        currentStreak += 1;
        bestStreak = Math.max(bestStreak, currentStreak);
        totalTime += guess.timeFromStartMs;
        correctTimeCount += 1;
      } else {
        currentStreak = 0;
      }
    }
  }

  const avgTimeMs = correctTimeCount > 0 ? Math.round(totalTime / correctTimeCount) : 0;
  const avgTimeSec = (avgTimeMs / 1000).toFixed(1);

  const statCards = [
    {
      icon: TrophyIcon,
      label: "Score",
      value: String(game.totalScore),
      color: "text-cdb-star",
    },
    {
      icon: TargetIcon,
      label: "Correct",
      value: `${String(correctCount)}/${String(game.roundCount)}`,
      color: "text-cdb-success",
    },
    {
      icon: FlameIcon,
      label: "Best streak",
      value: String(bestStreak),
      color: "text-cdb-warning",
    },
    {
      icon: ClockIcon,
      label: "Avg. time",
      value: correctTimeCount > 0 ? `${avgTimeSec}s` : "—",
      color: "text-cdb-info",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" as const }}
      className="flex flex-col items-center gap-8"
    >
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-display text-[40px] leading-none">Game over</h1>
        {/* Ranked / Unranked badge */}
        {game.isRanked ? (
          <Badge className="text-cdb-marquee-text border-[color-mix(in_oklch,var(--cdb-marquee)_32%,transparent)] bg-[color-mix(in_oklch,var(--cdb-marquee)_16%,transparent)] hover:bg-[color-mix(in_oklch,var(--cdb-marquee)_16%,transparent)]">
            <ShieldCheckIcon className="mr-1 size-3" />
            Ranked
          </Badge>
        ) : (
          <Badge variant="secondary">
            <ShieldOffIcon className="mr-1 size-3" />
            Unranked
          </Badge>
        )}
      </div>

      {/* New personal best celebration */}
      {isNewPersonalBest && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" as const }}
          className="flex items-center gap-2 rounded-lg border border-[color-mix(in_oklch,var(--cdb-star)_25%,transparent)] bg-[color-mix(in_oklch,var(--cdb-star)_10%,transparent)] px-4 py-2"
        >
          <SparklesIcon className="text-cdb-star size-5" />
          <span className="text-cdb-star text-sm font-semibold">New personal best!</span>
          <SparklesIcon className="text-cdb-star size-5" />
        </motion.div>
      )}

      {/* Stat cards */}
      <div className="grid w-full max-w-lg grid-cols-2 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.1 + index * 0.1,
              duration: 0.3,
              ease: "easeOut" as const,
            }}
          >
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-4">
                <stat.icon className={`size-6 ${stat.color}`} />
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                <p className="text-muted-foreground text-xs">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Round breakdown */}
      <div className="w-full max-w-lg">
        <h2 className="mb-3 text-base font-semibold">Round breakdown</h2>
        <div className="space-y-2">
          {game.rounds.map((round, index) => {
            const guess = round.guesses[0];
            return (
              <motion.div
                key={round.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 0.5 + index * 0.05,
                  duration: 0.2,
                  ease: "easeOut" as const,
                }}
                className="bg-card flex items-center gap-3 rounded-lg border p-3"
              >
                <span className="w-8 text-center font-mono text-xs text-[var(--fg-dim)]">
                  #{String(index + 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {renderRoundAnswer === undefined
                      ? ((round.roundData as Record<string, string>).title ?? "Unknown")
                      : renderRoundAnswer(round.roundData)}
                  </p>
                  {guess !== undefined && (
                    <p className="text-muted-foreground truncate text-xs">
                      Guessed: {guess.guessText}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {guess === undefined ? (
                    <span className="text-muted-foreground text-sm">Skipped</span>
                  ) : (
                    <>
                      <span className="text-sm font-semibold tabular-nums">
                        {guess.isCorrect ? `+${String(guess.scoreAwarded)}` : "0"}
                      </span>
                      <RoundIcon isCorrect={guess.isCorrect} />
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={onPlayAgain} size="lg">
          Play again
        </Button>
        <GameBackButton />
      </div>
    </motion.div>
  );
}

function RoundIcon({ isCorrect }: Readonly<{ isCorrect: boolean }>) {
  return (
    <div
      className={`flex size-[22px] items-center justify-center rounded-full text-xs ${
        isCorrect
          ? "text-cdb-success bg-[color-mix(in_oklch,var(--cdb-success)_20%,transparent)]"
          : "text-cdb-cherry-hi bg-[color-mix(in_oklch,var(--cdb-cherry)_18%,transparent)]"
      }`}
    >
      {isCorrect ? "✓" : "✗"}
    </div>
  );
}
