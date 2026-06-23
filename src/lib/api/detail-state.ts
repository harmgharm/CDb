import { FetchError } from "@/lib/api/fetch-error";

/** The render state of a detail page driven by a single SWR resource fetch. */
export type DetailState = "loading" | "not-found" | "error" | "ready";

interface DetailInputs {
  /** Whether the resource data is present (SWR `data !== undefined`). */
  readonly hasData: boolean;
  /** SWR `error` — a `FetchError` carries the HTTP status; a plain Error doesn't. */
  readonly error: Error | undefined;
}

/**
 * Decide what a detail page should render from its SWR state. Crucially, only a
 * genuine 404 maps to `not-found`; any other settled error (500, network) maps
 * to `error`, so a valid id is never shown the 404 page over a transient hiccup.
 * Pure, so the precedence is testable without SWR/React.
 *
 * Precedence:
 *  - data present → `ready` (even alongside a stale revalidation error).
 *  - a 404 error  → `not-found`.
 *  - any other error → `error`.
 *  - otherwise (no data, no error — SWR loading or the first render before
 *    `isLoading` flips) → `loading`, so a valid id never flashes the 404.
 */
export function resolveDetailState({ hasData, error }: DetailInputs): DetailState {
  if (hasData) {
    return "ready";
  }
  if (error !== undefined) {
    return error instanceof FetchError && error.status === 404 ? "not-found" : "error";
  }
  return "loading";
}
