/**
 * Title matching for guess validation
 *
 * Primary path: exact mediaId match via autocomplete selection.
 * Fallback: fuzzy text matching for free-typed guesses.
 */

const ARTICLES = /^(the|a|an)\s+/i;
const PUNCTUATION = /[^\d\sa-z]/g;
const WHITESPACE = /\s+/g;

/**
 * Normalize a title for comparison: lowercase, strip articles,
 * remove punctuation, collapse whitespace, trim.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(ARTICLES, "")
    .replaceAll(PUNCTUATION, "")
    .replaceAll(WHITESPACE, " ")
    .trim();
}

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const aLength = a.length;
  const bLength = b.length;

  if (aLength === 0) return bLength;
  if (bLength === 0) return aLength;

  // Use single-row optimization
  const previous = Array.from({ length: bLength + 1 }, (_, index) => index);

  for (let index = 1; index <= aLength; index++) {
    let previousDiagonal = previous[0] as number;
    previous[0] = index;

    for (let index_ = 1; index_ <= bLength; index_++) {
      const currentDiagonal = previous[index_] as number;
      const cost = a[index - 1] === b[index_ - 1] ? 0 : 1;

      previous[index_] = Math.min(
        (previous[index_] as number) + 1, // deletion
        (previous[index_ - 1] as number) + 1, // insertion
        previousDiagonal + cost, // substitution
      );

      previousDiagonal = currentDiagonal;
    }
  }

  return previous[bLength] as number;
}

/**
 * Compute similarity ratio between two strings (0 = no match, 1 = identical).
 */
function similarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLength;
}

const SIMILARITY_THRESHOLD = 0.8;

/**
 * Check if a guess matches the correct answer.
 *
 * Tries exact match first (after normalization), then fuzzy matching.
 */
export function isCorrectGuess(guess: string, answer: string): boolean {
  const normalizedGuess = normalizeTitle(guess);
  const normalizedAnswer = normalizeTitle(answer);

  // Exact match after normalization
  if (normalizedGuess === normalizedAnswer) return true;

  // Fuzzy match
  return similarity(normalizedGuess, normalizedAnswer) >= SIMILARITY_THRESHOLD;
}
