/**
 * Authenticated fetch wrapper with automatic token refresh.
 *
 * - On 401, attempts a single token refresh and retries the original request.
 * - Deduplicates concurrent refresh attempts so only one runs at a time,
 *   preventing refresh token reuse detection from invalidating the session.
 */

let refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  // If a refresh is already in-flight, piggyback on it
  if (refreshPromise !== null) {
    return refreshPromise;
  }

  refreshPromise = fetch("/api/auth/refresh", { method: "POST" })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

/**
 * Fetch wrapper that automatically retries on 401 after refreshing tokens.
 * Use this for all authenticated API calls outside of SWR.
 */
export async function fetchWithAuth(input: string, init?: RequestInit): Promise<Response> {
  let response = await fetch(input, init);

  if (response.status === 401) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      response = await fetch(input, init);
    }
  }

  return response;
}
