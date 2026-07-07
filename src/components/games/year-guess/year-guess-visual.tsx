"use client";

/**
 * YearGuessVisual — Shows poster, title, and countdown timer
 *
 * The media is fully visible (no blur). The player guesses the release year
 * before the countdown expires. Uses requestAnimationFrame for the timer.
 */

import * as motion from "motion/react-client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const DEFAULT_TOTAL_DURATION_MS = 10_000;

interface YearGuessVisualProps {
  readonly posterUrl: string;
  readonly title: string;
  readonly onTimeExpired?: () => void;
  readonly isPaused?: boolean;
  readonly totalDuration?: number;
  readonly guessedAtProgress?: number;
}

export function YearGuessVisual({
  posterUrl,
  title,
  onTimeExpired,
  isPaused = false,
  totalDuration = DEFAULT_TOTAL_DURATION_MS,
  guessedAtProgress,
}: YearGuessVisualProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const expiredFiredRef = useRef(false);

  const onTimeExpiredRef = useRef(onTimeExpired);
  onTimeExpiredRef.current = onTimeExpired;

  useEffect(() => {
    if (isPaused) {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
        pausedAtRef.current = performance.now();
      }
      return;
    }

    // Resume from pause — shift start time forward
    if (pausedAtRef.current !== null && startTimeRef.current !== null) {
      const pauseDuration = performance.now() - pausedAtRef.current;
      startTimeRef.current += pauseDuration;
      pausedAtRef.current = null;
    }

    // Initial start
    startTimeRef.current ??= performance.now();

    function loop() {
      if (startTimeRef.current === null) return;

      const now = performance.now();
      const elapsed = now - startTimeRef.current;
      const clamped = Math.min(elapsed, totalDuration);
      setElapsedMs(clamped);

      if (elapsed >= totalDuration && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        onTimeExpiredRef.current?.();
        return;
      }

      if (elapsed < totalDuration) {
        animationRef.current = requestAnimationFrame(loop);
      }
    }

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPaused, totalDuration]);

  const remainingMs = Math.max(0, totalDuration - elapsedMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const progress = elapsedMs / totalDuration;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Poster + title */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative aspect-[2/3] w-48 overflow-hidden rounded-lg shadow-2xl sm:w-56 md:w-64">
          <Image
            src={posterUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 192px, (max-width: 768px) 224px, 256px"
            priority
            unoptimized
          />
        </div>
        <h2 className="text-center text-xl font-bold">{title}</h2>
      </div>

      {/* Countdown timer */}
      <div className="flex items-center gap-2 text-sm">
        <TimerBar progress={progress} guessedAtProgress={guessedAtProgress} />
        <span className="text-muted-foreground tabular-nums">{String(remainingSeconds)}s</span>
        <TimerPhase progress={progress} />
      </div>
    </div>
  );
}

function TimerBar({
  progress,
  guessedAtProgress,
}: Readonly<{ progress: number; guessedAtProgress?: number }>) {
  const percentage = Math.min(progress * 100, 100);
  const colorClass = getTimerColor(percentage);

  return (
    <div className="bg-muted relative h-2 w-32 overflow-hidden rounded-full sm:w-48">
      <motion.div
        className={`h-full rounded-full ${colorClass}`}
        style={{ width: `${String(percentage)}%` }}
        transition={{ duration: 0.1 }}
      />
      {guessedAtProgress !== undefined && (
        <div
          className="absolute top-0 h-full w-0.5 bg-white shadow-sm"
          style={{ left: `${(guessedAtProgress * 100).toFixed(1)}%` }}
        />
      )}
    </div>
  );
}

function getTimerColor(percentage: number): string {
  if (percentage > 90) return "bg-cdb-cherry-hi";
  if (percentage > 66) return "bg-cdb-warning";
  return "bg-cdb-marquee";
}

function TimerPhase({ progress }: Readonly<{ progress: number }>) {
  if (progress >= 1)
    return <span className="text-cdb-cherry-hi text-xs font-semibold">Time&apos;s up!</span>;
  if (progress > 0.66)
    return <span className="text-cdb-warning text-xs font-semibold">Hurry!</span>;
  return <span className="text-cdb-info text-xs font-semibold">Guess the year...</span>;
}

/**
 * Get the start timestamp for scoring purposes.
 */
export function getRoundStartTime(): number {
  return Date.now();
}
