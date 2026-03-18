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

describe("HomePage", () => {
  beforeEach(() => {
    // Mock fetch to simulate unauthenticated user with no public stats
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => ({ data: null, error: "Unauthorized", message: null }),
      }),
    );
  });

  it("renders the heading", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /cinemadatabase/i })).toBeInTheDocument();
  });

  it("renders the description", () => {
    render(<HomePage />);
    expect(screen.getByText(/track movies, anime, and tv shows with friends/i)).toBeInTheDocument();
  });

  it("renders login and signup buttons", () => {
    render(<HomePage />);
    expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign up/i })).toBeInTheDocument();
  });
});
