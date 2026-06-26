/**
 * Canonical human labels for media types.
 *
 * Single source of truth so "Movie / TV Show / Anime" copy can't drift between
 * the type badge, activity feed, recommendation summaries, and the import
 * dialog's source-unavailable notice. Contexts that need a different grammatical
 * form (e.g. lowercase plurals mid-sentence) derive from these rather than
 * hand-rolling their own map.
 */

import type { MediaType } from "@/lib/db/types";

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  movie: "Movie",
  tv: "TV Show",
  anime: "Anime",
};
