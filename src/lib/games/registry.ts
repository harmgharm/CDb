/**
 * Game Engine Registry
 *
 * Maps GameType to its engine implementation. All engines are registered
 * at module load time via side-effect imports.
 */

import type { GameType } from "@/lib/db/types";

import type { GameEngine } from "./engine";

const engines = new Map<GameType, GameEngine>();

export function registerEngine(engine: GameEngine): void {
  if (engines.has(engine.gameType)) {
    throw new Error(`Engine already registered for game type: ${engine.gameType}`);
  }
  engines.set(engine.gameType, engine);
}

/**
 * Get the engine for a game type. Throws if not registered.
 */
export function getEngine(gameType: GameType): GameEngine {
  const engine = engines.get(gameType);
  if (engine === undefined) {
    throw new Error(`No engine registered for game type: ${gameType}`);
  }
  return engine;
}
