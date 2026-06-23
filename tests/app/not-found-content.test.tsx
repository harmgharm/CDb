import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NotFoundContent } from "@/components/not-found-content";

describe("NotFoundContent", () => {
  it("renders the editorial 'not found' heading", () => {
    render(<NotFoundContent homeHref="/home" homeLabel="Back home" />);

    // The masthead splits the title into lead + accent; both render.
    expect(screen.getByRole("heading")).toHaveTextContent(/page not found/i);
  });

  it("links back to the provided destination with the provided label", () => {
    render(<NotFoundContent homeHref="/home" homeLabel="Back home" />);

    const link = screen.getByRole("link", { name: /back home/i });
    expect(link).toHaveAttribute("href", "/home");
  });

  it("supports a different home destination (e.g. the root for a top-level miss)", () => {
    render(<NotFoundContent homeHref="/" homeLabel="Go to start" />);

    expect(screen.getByRole("link", { name: /go to start/i })).toHaveAttribute("href", "/");
  });
});
