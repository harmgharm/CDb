import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RecommendationsPage from "@/app/(main)/recommendations/page";

// The genre filter vocabulary must be canonical/static — present even when no
// recommendation data has loaded — so words don't flicker as caches churn.

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { username: "tester", displayName: "Tester" } }),
}));

vi.mock("swr", () => ({
  useSWRConfig: () => ({ mutate: vi.fn() }),
}));

const emptySection = { data: undefined, isLoading: false };
const noRefresh = { refresh: vi.fn(), isRefreshing: false };

vi.mock("@/hooks/use-recommendations", () => ({
  useRecommendationsByType: () => emptySection,
  useRefreshSection: () => noRefresh,
  useRefreshRecommendations: () => ({ refresh: vi.fn(), isRefreshing: false }),
  useDismissedRecommendations: () => ({ data: undefined }),
  useDismissRecommendation: () => ({ dismiss: vi.fn() }),
  useUndismissRecommendation: () => ({ undismiss: vi.fn(), isUndismissing: false }),
  useFilteredRecommendations: () => ({ data: undefined, isLoading: false }),
  useRefreshFilteredRecommendations: () => ({ refresh: vi.fn(), isRefreshing: false }),
}));

vi.mock("@/hooks/use-find-similar", () => ({
  useFindSimilar: () => ({
    results: [],
    isLoading: false,
    findSimilar: vi.fn(),
    reset: vi.fn(),
  }),
}));

describe("For You genre filter vocabulary", () => {
  it("offers the canonical genres even with no recommendation data loaded", () => {
    render(<RecommendationsPage />);

    expect(screen.getByRole("button", { name: "Toggle Award Winning" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Kids" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle War" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Horror" })).toBeInTheDocument();
  });

  it("renders genre words in lowercase sentence form", () => {
    render(<RecommendationsPage />);

    expect(screen.getByRole("button", { name: "Toggle Award Winning" })).toHaveTextContent(
      "award winning",
    );
  });
});
