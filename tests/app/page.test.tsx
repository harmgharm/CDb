import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the heading", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: /cinemadatabase/i }),
    ).toBeInTheDocument();
  });

  it("renders the description", () => {
    render(<HomePage />);
    expect(
      screen.getByText(/track movies, anime, and tv shows with friends/i),
    ).toBeInTheDocument();
  });
});
