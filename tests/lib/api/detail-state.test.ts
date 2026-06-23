import { describe, expect, it } from "vitest";

import { resolveDetailState } from "@/lib/api/detail-state";
import { FetchError } from "@/lib/api/fetch-error";

describe("resolveDetailState", () => {
  it("is loading when nothing has settled yet (no data, no error)", () => {
    // Covers both an in-flight fetch and the very first render before SWR flips
    // its flags — treat as loading, not not-found, so a valid id never flashes
    // the 404.
    expect(resolveDetailState({ hasData: false, error: undefined })).toBe("loading");
  });

  it("is ready once data has arrived", () => {
    expect(resolveDetailState({ hasData: true, error: undefined })).toBe("ready");
  });

  it("is not-found for a genuine 404 error", () => {
    const error = new FetchError("Media not found", 404);
    expect(resolveDetailState({ hasData: false, error })).toBe("not-found");
  });

  it("is error (NOT not-found) for a 500 server error", () => {
    const error = new FetchError("Internal Server Error", 500);
    expect(resolveDetailState({ hasData: false, error })).toBe("error");
  });

  it("is error for a network failure with no status", () => {
    // A plain Error (e.g. fetch rejected) carries no status — treat as a
    // transient error, never as a confirmed 404.
    const error = new Error("Failed to fetch");
    expect(resolveDetailState({ hasData: false, error })).toBe("error");
  });

  it("prefers ready over a stale error when data is present (revalidation kept old data)", () => {
    const error = new FetchError("Internal Server Error", 500);
    expect(resolveDetailState({ hasData: true, error })).toBe("ready");
  });
});

describe("FetchError", () => {
  it("carries the HTTP status alongside the message", () => {
    const error = new FetchError("User not found", 404);
    expect(error.status).toBe(404);
    expect(error.message).toBe("User not found");
    expect(error).toBeInstanceOf(Error);
  });
});
