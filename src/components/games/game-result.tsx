"use client";

/**
 * GameResult — End-of-game summary with scores and round breakdown
 */

import { ClockIcon, FlameIcon, TargetIcon, TrophyIcon } from "lucide-react";
import * as motion from "motion/react-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GameSessionResponse } from "@/types/game-responses";

interface GameResultProps {
  readonly game: GameSessionResponse;
  readonly onPlayAgain: () => void;
}

export function GameResult({ game, onPlayAgain }: GameResultProps) {
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
      label: "Total Score",
      value: String(game.totalScore),
      color: "text-yellow-500",
    },
    {
      icon: TargetIcon,
      label: "Correct",
      value: `${String(correctCount)}/${String(game.roundCount)}`,
      color: "text-green-500",
    },
    {
      icon: FlameIcon,
      label: "Best Streak",
      value: String(bestStreak),
      color: "text-orange-500",
    },
    {
      icon: ClockIcon,
      label: "Avg. Time",
      value: correctTimeCount > 0 ? `${avgTimeSec}s` : "—",
      color: "text-blue-500",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" as const }}
      className="flex flex-col items-center gap-8"
    >
      <h1 className="text-3xl font-bold">Game Over</h1>

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
        <h2 className="mb-3 text-lg font-semibold">Round Breakdown</h2>
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
                <span className="text-muted-foreground w-8 text-center text-sm font-medium">
                  #{String(index + 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{round.title ?? "Unknown"}</p>
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
                      <span className="text-sm font-medium tabular-nums">
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
          Play Again
        </Button>
      </div>
    </motion.div>
  );
}

function RoundIcon({ isCorrect }: Readonly<{ isCorrect: boolean }>) {
  return (
    <div
      className={`size-5 rounded-full ${isCorrect ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}`}
    >
      <span className="flex size-full items-center justify-center text-xs">
        {isCorrect ? "✓" : "✗"}
      </span>
    </div>
  );
}
