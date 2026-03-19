/**
 * Game engine barrel export
 *
 * Importing this module registers all game engines via side effects.
 * API routes should import { getEngine } from "@/lib/games" to ensure
 * all engines are available.
 */

// Register engines (side-effect imports)
import "./engines/poster-reveal";
import "./engines/rating-guess";

// Re-export public API
export type { CorrectnessResult, GameEngine, RoundPoolItem } from "./engine";
export { getEngine } from "./registry";
