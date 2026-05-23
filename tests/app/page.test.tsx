import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";

// Mock next/navigation — must be before the component import
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
}));

// Mock next/link to render a plain anchor
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.ComponentProps<"a">) =>
    React.createElement("a", { href, ...rest }, children),
}));

// Mock motion/react-client — each named export (div, span, etc.) becomes
// a plain HTML tag string so React renders the element without animation internals.
vi.mock("motion/react-client", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const mocked: Record<string, unknown> = {};

  for (const key of Object.keys(actual)) {
    mocked[key] =
      typeof actual[key] === "object" || typeof actual[key] === "function" ? key : actual[key];
  }

  return mocked;
});

// Mock motion/react to avoid animation internals in tests
vi.mock("motion/react", () => ({
  animate: vi.fn(() => ({ stop: vi.fn() })),
  useMotionValue: vi.fn(() => ({
    on: vi.fn(() => vi.fn()),
  })),
  useTransform: vi.fn(() => ({
    on: vi.fn(() => vi.fn()),
  })),
  useReducedMotion: vi.fn(() => false),
}));

const MOCK_PUBLIC_STATS = {
  mediaWatched: { movie: 10, tv: 5, anime: 3 },
  totalSessions: 18,
  totalRatings: 36,
  memberCount: 4,
  hoursWatched: 52,
  avgRating: 7.2,
  mostWatchedGenre: "Drama",
  recentMedia: [],
  topMedia: [],
};

describe("HomePage", () => {
  beforeEach(() => {
    // Mock fetch: 401 for auth, valid stats for public endpoint
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === "/api/stats/public") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: MOCK_PUBLIC_STATS, error: null, message: null }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ data: null, error: "Unauthorized", message: null }),
        });
      }),
    );
  });

  it("renders the heading", async () => {
    render(<HomePage />);
    expect(await screen.findByRole("heading", { name: /cdb/i })).toBeInTheDocument();
  });

  it("renders the description", async () => {
    render(<HomePage />);
    expect(await screen.findByText(/movie nights, logged/i)).toBeInTheDocument();
  });

  it("renders login and signup buttons", async () => {
    render(<HomePage />);
    expect(await screen.findAllByRole("link", { name: /log in/i })).not.toHaveLength(0);
    expect(await screen.findAllByRole("link", { name: /sign up/i })).not.toHaveLength(0);
  });
});
