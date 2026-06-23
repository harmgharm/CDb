import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { UpNextItem, UpNextSource, UseUpNextResult } from "@/hooks/use-up-next";

// Mock the data source — the card's own rendering is what's under test.
const mockUseUpNext = vi.fn<() => UseUpNextResult>();
vi.mock("@/hooks/use-up-next", () => ({
  useUpNext: () => mockUseUpNext(),
}));

// The card hides itself when the sidebar is collapsed; keep it expanded here.
const mockState = { value: "expanded" as "expanded" | "collapsed" };
vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ state: mockState.value }),
}));

// next/image -> plain img so jsdom renders the poster.
vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement("img", { src, alt }),
}));

import { UpNextCard } from "@/components/sidebar/up-next-card";

function makeItem(overrides: Partial<UpNextItem> = {}): UpNextItem {
  return {
    mediaId: "m1",
    title: "Dune",
    posterUrl: null,
    mediaType: "movie",
    href: "/database/m1",
    ...overrides,
  };
}

function result(
  data: UpNextItem | null,
  source: UpNextSource | null,
  isLoading = false,
): UseUpNextResult {
  return { data, source, isLoading };
}

describe("UpNextCard", () => {
  it("renders nothing when there is no Up Next item", () => {
    mockUseUpNext.mockReturnValue(result(null, null));
    const { container } = render(<UpNextCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the sidebar is collapsed", () => {
    mockState.value = "collapsed";
    mockUseUpNext.mockReturnValue(result(makeItem(), "in-progress"));
    const { container } = render(<UpNextCard />);
    expect(container).toBeEmptyDOMElement();
    mockState.value = "expanded";
  });

  describe("queue source", () => {
    const queueItem = makeItem({
      title: "Sinners",
      href: "/database/m-sinners",
      mediaId: "m-sinners",
      eyebrow: "UP NEXT · Wed · Jul 1",
      proposedBy: "Harm",
    });

    it("renders the queue eyebrow, title, and a 'Proposed by' line", () => {
      mockUseUpNext.mockReturnValue(result(queueItem, "queue"));
      render(<UpNextCard />);

      expect(screen.getByText("UP NEXT · Wed · Jul 1")).toBeInTheDocument();
      expect(screen.getByText("Sinners")).toBeInTheDocument();
      expect(screen.getByText(/Proposed by/i)).toBeInTheDocument();
      expect(screen.getByText("Harm")).toBeInTheDocument();
    });

    it("renders the NO DATE YET sentinel for a dateless scheduled pick", () => {
      mockUseUpNext.mockReturnValue(
        result(makeItem({ eyebrow: "UP NEXT · NO DATE YET", proposedBy: "Harm" }), "queue"),
      );
      render(<UpNextCard />);

      expect(screen.getByText("UP NEXT · NO DATE YET")).toBeInTheDocument();
    });

    it("links to the scheduled pick's media detail page", () => {
      mockUseUpNext.mockReturnValue(result(queueItem, "queue"));
      render(<UpNextCard />);

      expect(screen.getByRole("link")).toHaveAttribute("href", "/database/m-sinners");
    });

    it("never shows the dashboard-only 'Won the vote' line", () => {
      mockUseUpNext.mockReturnValue(result(queueItem, "queue"));
      render(<UpNextCard />);

      expect(screen.queryByText(/Won the vote/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Won on the tie-break/i)).not.toBeInTheDocument();
    });
  });

  describe("watchlist sources", () => {
    it("renders the static 'In progress' label for the watching source", () => {
      mockUseUpNext.mockReturnValue(result(makeItem({ title: "Watching" }), "in-progress"));
      render(<UpNextCard />);

      expect(screen.getByText("In progress")).toBeInTheDocument();
      expect(screen.getByText("Watching")).toBeInTheDocument();
    });

    it("renders the static watchlist label for the planning source", () => {
      mockUseUpNext.mockReturnValue(result(makeItem({ title: "Planning" }), "watchlist"));
      render(<UpNextCard />);

      expect(screen.getByText(/Up next in your watchlist/i)).toBeInTheDocument();
    });

    it("does not render a 'Proposed by' line for a watchlist source", () => {
      mockUseUpNext.mockReturnValue(result(makeItem(), "in-progress"));
      render(<UpNextCard />);

      expect(screen.queryByText(/Proposed by/i)).not.toBeInTheDocument();
    });
  });
});
