/**
 * Authenticated fetch wrapper with automatic token refresh.
 *
 * - On 401, attempts a single token refresh and retries the original request.
 * - Deduplicates concurrent refresh attempts so only one runs at a time,
 *   preventing refresh token reuse detection from invalidating the session.
 * - When refresh fails, notifies listeners so the auth provider can redirect.
 */

let refreshPromise: Promise<boolean> | null = null;
const refreshFailListeners = new Set<() => void>();

/**
 * Register a callback invoked when token refresh fails (session expired).
 * Returns an unsubscribe function.
 */
export function onRefreshFail(listener: () => void): () => void {
  refreshFailListeners.add(listener);
  return () => {
    refreshFailListeners.delete(listener);
  };
}

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

  const success = await refreshPromise;

  if (!success) {
    for (const listener of refreshFailListeners) {
      listener();
    }
  }

  return success;
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
