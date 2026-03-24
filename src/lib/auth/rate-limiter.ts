/**
 * Simple in-memory rate limiter
 *
 * Resets on server restart. Good enough for a small friend-group app.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number, windowMs: number) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  check(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // No entry or window expired — allow and start fresh
    if (!entry || now >= entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true };
    }

    // Within window — check count
    if (entry.count >= this.maxAttempts) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return { allowed: false, retryAfter };
    }

    entry.count++;
    return { allowed: true };
  }

  /** Reset the counter for a key (e.g., after successful login) */
  reset(key: string): void {
    this.store.delete(key);
  }

  /** Remove expired entries to prevent memory leaks */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** 10 login attempts per 15 minutes per IP (reset on success) */
export const loginLimiter = new RateLimiter(10, FIFTEEN_MINUTES);

/** 5 signup attempts per 15 minutes per IP */
export const signupLimiter = new RateLimiter(5, FIFTEEN_MINUTES);

/** 20 refresh attempts per 15 minutes per IP */
export const refreshLimiter = new RateLimiter(20, FIFTEEN_MINUTES);
