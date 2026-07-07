"use client";

/**
 * PosterReveal — Progressive blur-to-clear poster reveal animation
 *
 * Uses CSS filter: blur() driven by requestAnimationFrame.
 * The image is always full resolution; only the blur filter changes.
 */

import * as motion from "motion/react-client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const REVEAL_DURATION_MS = 10_000;
const GRACE_DURATION_MS = 5000;
const INITIAL_BLUR_PX = 40;

interface PosterRevealProps {
  readonly posterUrl: string;
  readonly revealDuration?: number;
  readonly graceDuration?: number;
  readonly onRevealComplete?: () => void;
  readonly onTimeExpired?: () => void;
  readonly isPaused?: boolean;
  readonly guessedAtProgress?: number;
}

export function PosterReveal({
  posterUrl,
  revealDuration = REVEAL_DURATION_MS,
  graceDuration = GRACE_DURATION_MS,
  onRevealComplete,
  onTimeExpired,
  isPaused = false,
  guessedAtProgress,
}: PosterRevealProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const revealFiredRef = useRef(false);
  const expiredFiredRef = useRef(false);

  const totalDuration = revealDuration + graceDuration;

  // Store callbacks in refs to avoid dependency issues
  const onRevealCompleteRef = useRef(onRevealComplete);
  onRevealCompleteRef.current = onRevealComplete;
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

      // Fire reveal callback once
      if (elapsed >= revealDuration && !revealFiredRef.current) {
        revealFiredRef.current = true;
        onRevealCompleteRef.current?.();
      }

      // Fire expired callback once
      if (elapsed >= totalDuration && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        onTimeExpiredRef.current?.();
        return; // Stop loop
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
  }, [isPaused, totalDuration, revealDuration]);

  // Calculate blur based on elapsed time
  const revealProgress = Math.min(elapsedMs / revealDuration, 1);
  const currentBlur = INITIAL_BLUR_PX * (1 - revealProgress);
  const brightness = 0.5 + 0.5 * revealProgress;

  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const totalSeconds = Math.floor(totalDuration / 1000);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Poster container */}
      <div className="relative aspect-[2/3] w-64 overflow-hidden rounded-lg shadow-2xl sm:w-72 md:w-80">
        <motion.div
          style={{
            filter: `blur(${String(currentBlur)}px) brightness(${String(brightness)})`,
          }}
          className="relative size-full"
        >
          <Image
            src={posterUrl}
            alt="Mystery poster"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 256px, (max-width: 768px) 288px, 320px"
            priority
            unoptimized
          />
        </motion.div>
      </div>

      {/* Timer */}
      <div className="flex items-center gap-2 text-sm">
        <TimerBar progress={elapsedMs / totalDuration} guessedAtProgress={guessedAtProgress} />
        <span className="text-muted-foreground tabular-nums">
          {String(elapsedSeconds)}s / {String(totalSeconds)}s
        </span>
        <PhaseIndicator
          elapsedMs={elapsedMs}
          revealDuration={revealDuration}
          totalDuration={totalDuration}
        />
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

interface PhaseIndicatorProps {
  readonly elapsedMs: number;
  readonly revealDuration: number;
  readonly totalDuration: number;
}

function getPhase(elapsedMs: number, revealDuration: number, totalDuration: number): string {
  if (elapsedMs >= totalDuration) return "expired";
  if (elapsedMs >= revealDuration) return "grace";
  return "revealing";
}

const PHASE_CONFIG: Record<string, { label: string; color: string }> = {
  revealing: { label: "Revealing...", color: "text-cdb-info" },
  grace: { label: "Guess now!", color: "text-cdb-warning" },
  expired: { label: "Time's up!", color: "text-cdb-cherry-hi" },
};

function PhaseIndicator({ elapsedMs, revealDuration, totalDuration }: PhaseIndicatorProps) {
  const phase = getPhase(elapsedMs, revealDuration, totalDuration);
  const entry = PHASE_CONFIG[phase] ?? PHASE_CONFIG.revealing;
  const label = entry?.label ?? "Revealing...";
  const color = entry?.color ?? "text-cdb-info";

  return <span className={`text-xs font-semibold ${color}`}>{label}</span>;
}

/**
 * Get the start timestamp for scoring purposes.
 * Call this when the round starts to establish the scoring baseline.
 */
export function getRoundStartTime(): number {
  return Date.now();
}
