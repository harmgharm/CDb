import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  TMDB_API_KEY: "v3-key",
  TMDB_ACCESS_TOKEN: undefined as string | undefined,
}));
vi.mock("@/lib/env", () => ({ env: mockEnv }));

import { searchMovies } from "@/lib/api/tmdb";

const fetchMock = vi.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) }),
);
vi.stubGlobal("fetch", fetchMock);

function lastCall(): { url: string; init: RequestInit | undefined } {
  const call = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit | undefined];
  return { url: call[0], init: call[1] };
}

describe("tmdbFetch auth", () => {
  beforeEach(() => {
    fetchMock.mockClear();
  });

  it("uses the api_key query param when no access token is configured", async () => {
    mockEnv.TMDB_ACCESS_TOKEN = undefined;

    await searchMovies("dune");

    const { url, init } = lastCall();
    expect(url).toContain("api_key=v3-key");
    expect((init?.headers as Record<string, string> | undefined)?.Authorization).toBeUndefined();
  });

  it("prefers a Bearer header and keeps the key out of the URL when the token is set", async () => {
    mockEnv.TMDB_ACCESS_TOKEN = "v4-read-token";

    await searchMovies("dune");

    const { url, init } = lastCall();
    expect(url).not.toContain("api_key");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer v4-read-token");
  });
});
