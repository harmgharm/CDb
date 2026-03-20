import { describe, expect, it, vi } from "vitest";

import { RateLimiter } from "@/lib/auth/rate-limiter";

describe("RateLimiter", () => {
  it("allows requests within the limit", () => {
    const limiter = new RateLimiter(3, 60_000);
    expect(limiter.check("ip1").allowed).toBe(true);
    expect(limiter.check("ip1").allowed).toBe(true);
    expect(limiter.check("ip1").allowed).toBe(true);
  });

  it("blocks after exceeding the limit", () => {
    const limiter = new RateLimiter(2, 60_000);
    limiter.check("ip1"); // 1
    limiter.check("ip1"); // 2
    const result = limiter.check("ip1"); // 3 — blocked
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    const limiter = new RateLimiter(1, 60_000);
    limiter.check("ip1"); // 1 — allowed
    expect(limiter.check("ip1").allowed).toBe(false); // blocked
    expect(limiter.check("ip2").allowed).toBe(true); // different key, allowed
  });

  it("resets counter for a key", () => {
    const limiter = new RateLimiter(1, 60_000);
    limiter.check("ip1"); // used up
    expect(limiter.check("ip1").allowed).toBe(false);

    limiter.reset("ip1");
    expect(limiter.check("ip1").allowed).toBe(true);
  });

  it("allows requests after window expires", () => {
    const limiter = new RateLimiter(1, 1000); // 1 second window

    limiter.check("ip1"); // use up limit
    expect(limiter.check("ip1").allowed).toBe(false);

    // Fast-forward past the window
    vi.useFakeTimers();
    vi.advanceTimersByTime(1001);
    expect(limiter.check("ip1").allowed).toBe(true);
    vi.useRealTimers();
  });

  it("returns retryAfter in seconds", () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(1, 60_000);
    limiter.check("ip1");
    const result = limiter.check("ip1");
    expect(result.allowed).toBe(false);
    // retryAfter should be approximately 60 seconds
    expect(result.retryAfter).toBe(60);
    vi.useRealTimers();
  });

  it("cleanup removes expired entries", () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(5, 1000);
    limiter.check("ip1");
    limiter.check("ip2");

    // Fast-forward past window
    vi.advanceTimersByTime(1001);
    limiter.cleanup();

    // After cleanup, both should start fresh
    expect(limiter.check("ip1").allowed).toBe(true);
    expect(limiter.check("ip2").allowed).toBe(true);
    vi.useRealTimers();
  });

  it("cleanup keeps active entries", () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(1, 60_000);
    limiter.check("ip1");

    // Don't advance past window
    vi.advanceTimersByTime(100);
    limiter.cleanup();

    // ip1 is still rate-limited
    expect(limiter.check("ip1").allowed).toBe(false);
    vi.useRealTimers();
  });
});
