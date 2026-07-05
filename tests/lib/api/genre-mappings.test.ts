import { describe, expect, it } from "vitest";

import { getMalGenreId } from "@/lib/api/jikan-genres";
import { getMovieGenreId, getTvGenreId } from "@/lib/api/tmdb-genres";

describe("getTvGenreId alias resolution", () => {
  it("resolves War to the TV genre War & Politics", () => {
    expect(getTvGenreId("War")).toBe(10_768);
  });

  it("resolves Action and Adventure to the TV genre Action & Adventure", () => {
    expect(getTvGenreId("Action")).toBe(10_759);
    expect(getTvGenreId("Adventure")).toBe(10_759);
  });

  it("resolves Sci-Fi, Science Fiction, and Fantasy to the TV genre Sci-Fi & Fantasy", () => {
    expect(getTvGenreId("Sci-Fi")).toBe(10_765);
    expect(getTvGenreId("Science Fiction")).toBe(10_765);
    expect(getTvGenreId("Fantasy")).toBe(10_765);
  });

  it("still resolves exact TV genre names", () => {
    expect(getTvGenreId("Kids")).toBe(10_762);
    expect(getTvGenreId("War & Politics")).toBe(10_768);
  });
});

describe("getMovieGenreId alias resolution", () => {
  it("resolves Sci-Fi to the movie genre Science Fiction", () => {
    expect(getMovieGenreId("Sci-Fi")).toBe(878);
  });

  it("still resolves exact movie genre names", () => {
    expect(getMovieGenreId("War")).toBe(10_752);
    expect(getMovieGenreId("Science Fiction")).toBe(878);
  });
});

describe("getMalGenreId MAL-only genres", () => {
  it("resolves Award Winning", () => {
    expect(getMalGenreId("Award Winning")).toBe(46);
  });

  it("resolves Kids", () => {
    expect(getMalGenreId("Kids")).toBe(15);
  });

  it("keeps existing TMDB-name aliases working", () => {
    expect(getMalGenreId("War")).toBe(38);
    expect(getMalGenreId("Thriller")).toBe(41);
    expect(getMalGenreId("History")).toBe(13);
  });

  it("resolves Crime to Organized Crime, not the loose Psychological proxy", () => {
    expect(getMalGenreId("Crime")).toBe(68);
    expect(getMalGenreId("Psychological")).toBe(40);
  });
});
