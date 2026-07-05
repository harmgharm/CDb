/**
 * Static MAL (Jikan) anime genre name → ID mappings
 *
 * MAL genre IDs from https://api.jikan.moe/v4/genres/anime
 * Our DB stores genre names (from TMDB); this maps them to MAL genre IDs
 * for Jikan's anime discover endpoint.
 */

/** MAL anime genre ID → name */
export const MAL_ANIME_GENRES: Readonly<Record<number, string>> = {
  1: "Action",
  2: "Adventure",
  4: "Comedy",
  8: "Drama",
  10: "Fantasy",
  14: "Horror",
  7: "Mystery",
  22: "Romance",
  24: "Sci-Fi",
  36: "Slice of Life",
  30: "Sports",
  37: "Supernatural",
  41: "Suspense",
  13: "Historical",
  17: "Martial Arts",
  18: "Mecha",
  19: "Music",
  29: "Space",
  38: "Military",
  40: "Psychological",
  46: "Award Winning",
  15: "Kids",
  68: "Organized Crime",
};

/**
 * TMDB-to-MAL genre name aliases.
 * Our DB may store TMDB genre names that differ from MAL names.
 */
const GENRE_ALIASES: Readonly<Record<string, string>> = {
  "science fiction": "sci-fi",
  thriller: "suspense",
  history: "historical",
  war: "military",
  // MAL's closest true crime genre — Psychological was the old proxy, but it
  // drags in non-crime titles (character-study anime tagged Psychological).
  crime: "organized crime",
};

/** Get the MAL genre ID for a genre name (case-insensitive), or null */
export function getMalGenreId(genreName: string): number | null {
  const lower = genreName.toLowerCase();

  for (const [id, name] of Object.entries(MAL_ANIME_GENRES)) {
    if (name.toLowerCase() === lower) {
      return Number(id);
    }
  }

  // Try aliases for TMDB genre names that differ from MAL
  const aliasName = GENRE_ALIASES[lower];
  if (aliasName !== undefined) {
    for (const [id, name] of Object.entries(MAL_ANIME_GENRES)) {
      if (name.toLowerCase() === aliasName) {
        return Number(id);
      }
    }
  }

  return null;
}
