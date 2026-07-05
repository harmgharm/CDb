/**
 * Canonical genre filter list for the For You page.
 *
 * The filter sentence used to derive its genre words from whatever
 * recommendations happened to be loaded, so words appeared and disappeared as
 * caches churned. This is the stable vocabulary instead: the union of TMDB
 * movie/TV genres and the MAL anime genres we map, merged across vocabularies
 * (War covers Military and War & Politics; Thriller covers Suspense; History
 * covers Historical; Sci-Fi covers Science Fiction and Sci-Fi & Fantasy).
 *
 * Junk TV-listing genres (News, Reality, Soap, Talk, TV Movie) are excluded.
 * Every entry must resolve to at least one vertical's genre id via
 * getMovieGenreId / getTvGenreId / getMalGenreId — a test enforces this so no
 * filter word is ever dead.
 */
export const CANONICAL_GENRES: readonly string[] = [
  "Action",
  "Adventure",
  "Animation",
  "Award Winning",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Kids",
  "Martial Arts",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Space",
  "Sports",
  "Supernatural",
  "Thriller",
  "War",
  "Western",
];
