import { describe, expect, it } from "vitest";

import { isCorrectGuess, normalizeTitle } from "@/lib/games/matching";

describe("normalizeTitle", () => {
  it("lowercases input", () => {
    expect(normalizeTitle("INCEPTION")).toBe("inception");
  });

  it("strips leading articles (the, a, an)", () => {
    expect(normalizeTitle("The Dark Knight")).toBe("dark knight");
    expect(normalizeTitle("A Beautiful Mind")).toBe("beautiful mind");
    expect(normalizeTitle("An Education")).toBe("education");
  });

  it("does not strip articles that appear mid-title", () => {
    // The regex ^(the|a|an)\s+ only removes leading articles
    // "the" mid-title is preserved
    expect(normalizeTitle("Attack on the Titan")).toBe("attack on the titan");
  });

  it("removes punctuation", () => {
    expect(normalizeTitle("Spider-Man: No Way Home")).toBe("spiderman no way home");
  });

  it("collapses multiple whitespace into single spaces", () => {
    expect(normalizeTitle("  Star   Wars  ")).toBe("star wars");
  });

  it("handles empty string", () => {
    expect(normalizeTitle("")).toBe("");
  });

  it("handles a string that is only an article (no trailing space, not stripped)", () => {
    // "The" alone doesn't match ^(the)\s+ because there's no trailing whitespace
    expect(normalizeTitle("The")).toBe("the");
  });

  it("handles unicode and special characters", () => {
    expect(normalizeTitle("Amélie")).toBe("amlie");
  });

  it("handles numbers in titles", () => {
    // "A" is only stripped when it's the leading word — "2001:" starts the title
    // so "A" mid-title is preserved
    expect(normalizeTitle("2001: A Space Odyssey")).toBe("2001 a space odyssey");
  });
});

describe("isCorrectGuess", () => {
  it("returns true for exact match after normalization", () => {
    expect(isCorrectGuess("The Dark Knight", "The Dark Knight")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isCorrectGuess("the dark knight", "The Dark Knight")).toBe(true);
    expect(isCorrectGuess("THE DARK KNIGHT", "the dark knight")).toBe(true);
  });

  it("ignores leading articles", () => {
    expect(isCorrectGuess("Dark Knight", "The Dark Knight")).toBe(true);
    expect(isCorrectGuess("The Dark Knight", "Dark Knight")).toBe(true);
  });

  it("ignores punctuation differences", () => {
    expect(isCorrectGuess("Spider-Man", "Spiderman")).toBe(true);
    expect(isCorrectGuess("Spider Man: No Way Home", "Spider-Man: No Way Home")).toBe(true);
  });

  it("handles fuzzy matching for minor typos", () => {
    // "inceptoin" vs "inception" — Levenshtein 2 transposition, 9 chars → similarity ~0.78
    // Actually let's test closer matches
    expect(isCorrectGuess("Inceptio", "Inception")).toBe(true); // 1 char off, similarity ~0.89
  });

  it("rejects clearly wrong guesses", () => {
    expect(isCorrectGuess("Interstellar", "Inception")).toBe(false);
    expect(isCorrectGuess("Star Wars", "Star Trek")).toBe(false);
  });

  it("rejects empty guess", () => {
    expect(isCorrectGuess("", "Inception")).toBe(false);
  });

  it("handles both strings being empty", () => {
    expect(isCorrectGuess("", "")).toBe(true);
  });

  it("handles short titles where one-char difference matters more", () => {
    // "Up" vs "Us" — normalized: "up" vs "us", length 2, distance 1, similarity 0.5
    expect(isCorrectGuess("Up", "Us")).toBe(false);
  });

  it("handles long titles with minor differences (fuzzy match)", () => {
    // Minor typo in a long title should still match
    expect(
      isCorrectGuess(
        "The Lord of the Rings: The Fellowship of the Ring",
        "The Lord of the Rings: The Fellowship of the Rings",
      ),
    ).toBe(true);
  });

  it("handles anime titles with colons and subtitles", () => {
    expect(isCorrectGuess("Attack on Titan", "Attack on Titan")).toBe(true);
    expect(isCorrectGuess("My Hero Academia", "My Hero Academia")).toBe(true);
  });

  it("similarity threshold is approximately 0.8", () => {
    // "Inception" normalized = "inception" (9 chars)
    // Need similarity >= 0.8, so max distance = floor(9 * 0.2) = 1
    expect(isCorrectGuess("Inceptiom", "Inception")).toBe(true); // distance 1, sim ~0.89
    expect(isCorrectGuess("Inceptxyz", "Inception")).toBe(false); // distance 3, sim ~0.67
  });
});
