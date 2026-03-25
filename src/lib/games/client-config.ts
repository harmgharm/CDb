"use client";

/**
 * Client-side game config registry
 *
 * Lightweight config lookup for game type metadata used in shared UI components.
 * Components are NOT stored here — they live in their own files and are imported
 * directly by page-level components.
 */

import type { LucideIcon } from "lucide-react";
import { CalendarIcon, ImageIcon, StarIcon } from "lucide-react";

import type { GameType } from "@/lib/db/types";

export interface ClientGameConfig {
  gameType: GameType;
  displayName: string;
  basePath: string;
  description: string;
  icon: LucideIcon;
}

const configs = new Map<GameType, ClientGameConfig>([
  [
    "poster_reveal",
    {
      gameType: "poster_reveal",
      displayName: "Poster Reveal",
      basePath: "/play/poster-reveal",
      description:
        "A blurred poster slowly reveals itself. Guess the movie, show, or anime before time runs out! Play solo or compete with friends.",
      icon: ImageIcon,
    },
  ],
  [
    "rating_guess",
    {
      gameType: "rating_guess",
      displayName: "Rating Guesser",
      basePath: "/play/rating-guess",
      description:
        "See a movie, show, or anime and guess its rating. The closer your guess, the more points you earn! Play solo or compete with friends.",
      icon: StarIcon,
    },
  ],
  [
    "year_guess",
    {
      gameType: "year_guess",
      displayName: "Year Guesser",
      basePath: "/play/year-guess",
      description:
        "See a movie, show, or anime and guess when it was released. The closer your guess, the more points you earn! Play solo or compete with friends.",
      icon: CalendarIcon,
    },
  ],
]);

/**
 * Get the client config for a game type. Returns undefined if not registered.
 */
export function getClientGameConfig(gameType: GameType): ClientGameConfig | undefined {
  return configs.get(gameType);
}

/**
 * Get all registered game configs (for game hub).
 */
export function getAllGameConfigs(): ClientGameConfig[] {
  return [...configs.values()];
}

/**
 * Register a new game config (called by game modules at import time).
 */
export function registerClientGameConfig(config: ClientGameConfig): void {
  configs.set(config.gameType, config);
}
