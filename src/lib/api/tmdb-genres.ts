/**
 * Static TMDB genre ID ↔ name mappings
 *
 * Our DB stores genre names (e.g., "Action") but TMDB's discover endpoint
 * requires numeric genre IDs (e.g., 28). These maps bridge that gap.
 */

/** TMDB genre ID → name (movies) */
export const TMDB_MOVIE_GENRES: Readonly<Record<number, string>> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10_751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10_402: "Music",
  9648: "Mystery",
  10_749: "Romance",
  878: "Science Fiction",
  10_770: "TV Movie",
  53: "Thriller",
  10_752: "War",
  37: "Western",
};

/** TMDB genre ID → name (TV) */
export const TMDB_TV_GENRES: Readonly<Record<number, string>> = {
  10_759: "Action & Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10_751: "Family",
  10_762: "Kids",
  9648: "Mystery",
  10_763: "News",
  10_764: "Reality",
  10_765: "Sci-Fi & Fantasy",
  10_766: "Soap",
  10_767: "Talk",
  10_768: "War & Politics",
  37: "Western",
};

/** Reverse mapping: genre name → TMDB genre IDs (movie IDs preferred) */
function buildReverseMapping(): Readonly<Record<string, readonly number[]>> {
  const map: Record<string, number[]> = {};

  for (const [id, name] of Object.entries(TMDB_MOVIE_GENRES)) {
    const existing = map[name] ?? [];
    existing.push(Number(id));
    map[name] = existing;
  }
  for (const [id, name] of Object.entries(TMDB_TV_GENRES)) {
    const existing = map[name] ?? [];
    existing.push(Number(id));
    map[name] = existing;
  }

  return map;
}

export const GENRE_NAME_TO_TMDB_IDS: Readonly<Record<string, readonly number[]>> =
  buildReverseMapping();

/** Get the first TMDB movie genre ID for a genre name, or null */
export function getMovieGenreId(genreName: string): number | null {
  for (const [id, name] of Object.entries(TMDB_MOVIE_GENRES)) {
    if (name.toLowerCase() === genreName.toLowerCase()) {
      return Number(id);
    }
  }
  return null;
}

/** Get the first TMDB TV genre ID for a genre name, or null */
export function getTvGenreId(genreName: string): number | null {
  for (const [id, name] of Object.entries(TMDB_TV_GENRES)) {
    if (name.toLowerCase() === genreName.toLowerCase()) {
      return Number(id);
    }
  }
  return null;
}
