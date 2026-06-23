/**
 * An Error carrying the HTTP status of a failed API response, so SWR consumers
 * can distinguish a genuine 404 (resource missing → render a not-found page)
 * from a transient failure (500 / network → render a retryable error state).
 * The SWR fetcher throws this; a plain `Error` (e.g. a rejected fetch) has no
 * status and is treated as a transient error.
 */
export class FetchError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FetchError";
    this.status = status;
  }
}
