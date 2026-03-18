"use client";

/**
 * PlayerGuessIndicator — Shows animated notifications when players guess
 *
 * Displayed during a multiplayer round when player-guessed events arrive.
 */

import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { useCallback, useState } from "react";

import type { PlayerGuessedEvent } from "@/types/game-responses";

interface IndicatorEntry {
  id: string;
  event: PlayerGuessedEvent;
}

let indicatorCounter = 0;

function removeIndicatorById(
  id: string,
  setter: (updater: (previous: IndicatorEntry[]) => IndicatorEntry[]) => void,
) {
  setter((previous) => previous.filter((entry) => entry.id !== id));
}

export function usePlayerGuessIndicators() {
  const [indicators, setIndicators] = useState<IndicatorEntry[]>([]);

  const addIndicator = useCallback((event: PlayerGuessedEvent) => {
    indicatorCounter += 1;
    const id = `indicator-${String(indicatorCounter)}`;
    setIndicators((previous) => [...previous, { id, event }]);

    // Auto-remove after animation
    setTimeout(() => {
      removeIndicatorById(id, setIndicators);
    }, 3000);
  }, []);

  const clearIndicators = useCallback(() => {
    setIndicators([]);
  }, []);

  return { indicators, addIndicator, clearIndicators };
}

interface PlayerGuessIndicatorsProps {
  readonly indicators: IndicatorEntry[];
}

export function PlayerGuessIndicators({ indicators }: PlayerGuessIndicatorsProps) {
  return (
    <div className="pointer-events-none fixed top-20 right-4 z-50 space-y-2">
      <AnimatePresence>
        {indicators.map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{ duration: 0.3, ease: "easeOut" as const }}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 shadow-lg backdrop-blur-sm ${
              entry.event.isCorrect
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-red-500/30 bg-red-500/10"
            }`}
          >
            {entry.event.isCorrect ? (
              <CheckCircle2Icon className="size-4 text-emerald-500" />
            ) : (
              <XCircleIcon className="size-4 text-red-500" />
            )}
            <span className="text-sm font-medium">
              {entry.event.username}
              {entry.event.isCorrect ? " guessed correctly!" : " guessed wrong"}
            </span>
            {entry.event.isFirstCorrect && (
              <span className="text-xs font-bold text-yellow-500">FIRST!</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
