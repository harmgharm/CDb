import { describe, expect, it } from "vitest";

import { deriveTagline, type TaglineInputs } from "@/lib/users/tagline";

function makeInputs(overrides: Partial<TaglineInputs> = {}): TaglineInputs {
  return {
    ratingsGiven: 10,
    avgScore: 7.2,
    sessionsAttended: 12,
    pickCount: 2,
    totalSessionsGlobal: 30,
    mediaTypeBreakdown: { movie: 0.4, tv: 0.3, anime: 0.3 },
    topGenre: null,
    recentStreak: null,
    daysSinceJoined: 90,
    ...overrides,
  };
}

const REPRESENTATIVE_FIXTURES: TaglineInputs[] = [
  makeInputs(),
  makeInputs({
    recentStreak: { genre: "horror", hits: 6, window: 8 },
  }),
  makeInputs({
    topGenre: { name: "sci-fi", count: 47 },
    sessionsAttended: 47,
    avgScore: 8.1,
    ratingsGiven: 40,
  }),
  makeInputs({
    pickCount: 12,
    totalSessionsGlobal: 28,
    mediaTypeBreakdown: { movie: 0.1, tv: 0.05, anime: 0.85 },
  }),
  makeInputs({ avgScore: 8.2, ratingsGiven: 20 }),
  makeInputs({ avgScore: 5.8, ratingsGiven: 20 }),
  makeInputs({
    mediaTypeBreakdown: { movie: 0.1, tv: 0.05, anime: 0.85 },
    ratingsGiven: 1,
  }),
  makeInputs({
    sessionsAttended: 0,
    ratingsGiven: 0,
    pickCount: 0,
    mediaTypeBreakdown: null,
    daysSinceJoined: 3,
  }),
  makeInputs({
    sessionsAttended: 0,
    ratingsGiven: 0,
    pickCount: 0,
    mediaTypeBreakdown: null,
    daysSinceJoined: 500,
  }),
];

describe("deriveTagline — recent streak branch", () => {
  it("uses recent streak when 6 of last 8 share a genre", () => {
    const out = deriveTagline(
      makeInputs({
        recentStreak: { genre: "horror", hits: 6, window: 8 },
      }),
    );
    expect(out).toBe("On a horror streak. 6 of the last 8.");
  });

  it("falls through when streak hits are below threshold", () => {
    const out = deriveTagline(
      makeInputs({
        recentStreak: { genre: "horror", hits: 4, window: 8 },
        avgScore: 7,
        ratingsGiven: 20,
      }),
    );
    expect(out).not.toContain("streak");
  });

  it("title-cases hyphenated genre names", () => {
    const out = deriveTagline(
      makeInputs({
        recentStreak: { genre: "sci-fi", hits: 5, window: 8 },
      }),
    );
    expect(out).toBe("On a sci-fi streak. 5 of the last 8.");
  });
});

describe("deriveTagline — genre devotee branch", () => {
  it("returns devotee line for a clear top genre with avg", () => {
    const out = deriveTagline(
      makeInputs({
        topGenre: { name: "sci-fi", count: 12 },
        sessionsAttended: 47,
        avgScore: 8.1,
        ratingsGiven: 40,
      }),
    );
    expect(out).toBe("Sci-fi devotee. 47 watched, 8.1 avg.");
  });

  it("title-cases simple lowercase genres", () => {
    const out = deriveTagline(
      makeInputs({
        topGenre: { name: "horror", count: 8 },
        sessionsAttended: 20,
        avgScore: 7.5,
        ratingsGiven: 18,
      }),
    );
    expect(out).toContain("Horror devotee.");
  });

  it("omits avg tail when avgScore is null", () => {
    const out = deriveTagline(
      makeInputs({
        topGenre: { name: "horror", count: 8 },
        sessionsAttended: 20,
        avgScore: null,
        ratingsGiven: 0,
      }),
    );
    expect(out).toBe("Horror devotee. 20 watched.");
  });

  it("falls through when top genre count is below threshold", () => {
    const out = deriveTagline(
      makeInputs({
        topGenre: { name: "horror", count: 2 },
        avgScore: 7,
        ratingsGiven: 20,
      }),
    );
    expect(out).not.toContain("devotee");
  });
});

describe("deriveTagline — picker tendency branch", () => {
  it("returns picker line for an active picker", () => {
    const out = deriveTagline(
      makeInputs({
        pickCount: 12,
        totalSessionsGlobal: 28,
        mediaTypeBreakdown: { movie: 0.1, tv: 0.05, anime: 0.85 },
      }),
    );
    expect(out).toBe("Picked 12 of the last 28 nights. Mostly anime.");
  });

  it("omits media-lean tail when no clear lean", () => {
    const out = deriveTagline(
      makeInputs({
        pickCount: 10,
        totalSessionsGlobal: 28,
        mediaTypeBreakdown: { movie: 0.34, tv: 0.33, anime: 0.33 },
      }),
    );
    expect(out).toBe("Picked 10 of the last 28 nights.");
  });

  it("falls through when pickCount is below threshold", () => {
    const out = deriveTagline(
      makeInputs({
        pickCount: 1,
        avgScore: 7,
        ratingsGiven: 20,
      }),
    );
    expect(out).not.toContain("Picked");
  });

  it("does not divide by zero when totalSessionsGlobal is 0", () => {
    const out = deriveTagline(
      makeInputs({
        pickCount: 0,
        totalSessionsGlobal: 0,
        sessionsAttended: 0,
        ratingsGiven: 0,
        mediaTypeBreakdown: null,
        daysSinceJoined: 500,
      }),
    );
    expect(out).toBeTruthy();
    expect(out).not.toContain("NaN");
    expect(out).not.toContain("Infinity");
  });
});

describe("deriveTagline — rating personality branch", () => {
  it("calls a high-average rater generous", () => {
    const out = deriveTagline(makeInputs({ avgScore: 8.2, ratingsGiven: 20 }));
    expect(out).toBe("Generous rater. Averages 8.2.");
  });

  it("calls a low-average rater tough", () => {
    const out = deriveTagline(makeInputs({ avgScore: 5.8, ratingsGiven: 20 }));
    expect(out).toBe("Tough crowd. Averages 5.8.");
  });

  it("calls a middling rater steady", () => {
    const out = deriveTagline(makeInputs({ avgScore: 7, ratingsGiven: 20 }));
    expect(out).toBe("Steady rater. Averages 7.0.");
  });

  it("requires a minimum sample of ratings before firing", () => {
    const out = deriveTagline(
      makeInputs({
        avgScore: 9,
        ratingsGiven: 1,
        pickCount: 0,
        mediaTypeBreakdown: null,
        daysSinceJoined: 500,
      }),
    );
    expect(out).not.toContain("rater");
    expect(out).not.toContain("crowd");
  });
});

describe("deriveTagline — media lean branch", () => {
  it("returns mostly-anime when anime majority is clear", () => {
    const out = deriveTagline(
      makeInputs({
        mediaTypeBreakdown: { movie: 0.1, tv: 0.05, anime: 0.85 },
        ratingsGiven: 1,
        pickCount: 0,
      }),
    );
    expect(out).toBe("Mostly anime. 85% by session.");
  });

  it("returns mostly-movies when movie majority is clear", () => {
    const out = deriveTagline(
      makeInputs({
        mediaTypeBreakdown: { movie: 0.7, tv: 0.2, anime: 0.1 },
        ratingsGiven: 1,
        pickCount: 0,
      }),
    );
    expect(out).toBe("Mostly movies. 70% by session.");
  });

  it("falls through when breakdown is roughly even", () => {
    const out = deriveTagline(
      makeInputs({
        mediaTypeBreakdown: { movie: 0.34, tv: 0.33, anime: 0.33 },
        ratingsGiven: 1,
        pickCount: 0,
        sessionsAttended: 0,
        daysSinceJoined: 500,
      }),
    );
    expect(out).not.toContain("Mostly");
  });
});

describe("deriveTagline — new user branch", () => {
  it("returns just-joined for a new user with no activity", () => {
    const out = deriveTagline(
      makeInputs({
        sessionsAttended: 0,
        ratingsGiven: 0,
        pickCount: 0,
        mediaTypeBreakdown: null,
        daysSinceJoined: 3,
      }),
    );
    expect(out).toBe("Just joined. No ratings yet.");
  });

  it("does not call long-time inactive users new", () => {
    const out = deriveTagline(
      makeInputs({
        sessionsAttended: 0,
        ratingsGiven: 0,
        pickCount: 0,
        mediaTypeBreakdown: null,
        daysSinceJoined: 400,
      }),
    );
    expect(out).not.toContain("Just joined");
  });
});

describe("deriveTagline — fallback branch", () => {
  it("returns a safety-net string for an inactive long-time user", () => {
    const out = deriveTagline(
      makeInputs({
        sessionsAttended: 0,
        ratingsGiven: 0,
        pickCount: 0,
        mediaTypeBreakdown: null,
        daysSinceJoined: 400,
      }),
    );
    expect(out).toBe("Watching along.");
  });
});

describe("deriveTagline — priority order", () => {
  it("prefers recent streak over genre devotee", () => {
    const out = deriveTagline(
      makeInputs({
        recentStreak: { genre: "horror", hits: 6, window: 8 },
        topGenre: { name: "sci-fi", count: 47 },
        sessionsAttended: 47,
        avgScore: 8.1,
        ratingsGiven: 40,
      }),
    );
    expect(out).toContain("horror streak");
    expect(out).not.toContain("Sci-fi");
  });

  it("prefers genre devotee over picker tendency", () => {
    const out = deriveTagline(
      makeInputs({
        topGenre: { name: "horror", count: 12 },
        sessionsAttended: 30,
        avgScore: 7.5,
        ratingsGiven: 28,
        pickCount: 12,
        totalSessionsGlobal: 28,
      }),
    );
    expect(out).toContain("Horror devotee");
    expect(out).not.toContain("Picked");
  });

  it("prefers picker tendency over rating personality", () => {
    const out = deriveTagline(
      makeInputs({
        pickCount: 12,
        totalSessionsGlobal: 28,
        avgScore: 8.2,
        ratingsGiven: 20,
      }),
    );
    expect(out).toContain("Picked");
    expect(out).not.toContain("Generous");
  });

  it("prefers rating personality over media lean", () => {
    const out = deriveTagline(
      makeInputs({
        avgScore: 8.2,
        ratingsGiven: 20,
        mediaTypeBreakdown: { movie: 0.1, tv: 0.05, anime: 0.85 },
        pickCount: 0,
      }),
    );
    expect(out).toContain("Generous");
    expect(out).not.toContain("Mostly");
  });

  it("prefers media lean over new user when both could fire", () => {
    const out = deriveTagline(
      makeInputs({
        mediaTypeBreakdown: { movie: 0.1, tv: 0.05, anime: 0.85 },
        sessionsAttended: 5,
        ratingsGiven: 1,
        pickCount: 0,
        daysSinceJoined: 3,
      }),
    );
    expect(out).toContain("Mostly");
    expect(out).not.toContain("Just joined");
  });
});

describe("deriveTagline — invariants", () => {
  it.each(REPRESENTATIVE_FIXTURES)("returns a non-empty trimmed string", (inputs) => {
    const out = deriveTagline(inputs);
    expect(out.length).toBeGreaterThan(0);
    expect(out).toBe(out.trim());
  });

  it.each(REPRESENTATIVE_FIXTURES)("never contains an em-dash or en-dash", (inputs) => {
    expect(deriveTagline(inputs)).not.toMatch(/[—–]/);
  });

  it.each(REPRESENTATIVE_FIXTURES)("ends with a period", (inputs) => {
    expect(deriveTagline(inputs)).toMatch(/\.$/);
  });
});
