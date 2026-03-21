/**
 * Authenticated fetch wrapper with automatic token refresh.
 *
 * - On 401, attempts a single token refresh and retries the original request.
 * - Deduplicates concurrent refresh attempts within a tab so only one runs at a time.
 * - Uses BroadcastChannel to coordinate refresh across browser tabs, preventing
 *   refresh token reuse detection from revoking the entire token family.
 * - When refresh fails, notifies listeners so the auth provider can redirect.
 */

let refreshPromise: Promise<boolean> | null = null;
const refreshFailListeners = new Set<() => void>();

// ---------------------------------------------------------------------------
// Cross-tab refresh coordination via BroadcastChannel
// ---------------------------------------------------------------------------
type RefreshMessage = { type: "refresh-start" } | { type: "refresh-done"; success: boolean };

let channel: BroadcastChannel | null = null;
/** Promise that resolves when another tab finishes its refresh. */
let crossTabRefreshPromise: Promise<boolean> | null = null;
let resolveCrossTabRefresh: ((success: boolean) => void) | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (channel === null) {
    channel = new BroadcastChannel("cdb-auth-refresh");
    channel.addEventListener("message", (event: MessageEvent<RefreshMessage>) => {
      const message = event.data;
      if (message.type === "refresh-start" && crossTabRefreshPromise === null) {
        // Another tab started refreshing — wait for its result
        crossTabRefreshPromise = new Promise<boolean>((resolve) => {
          resolveCrossTabRefresh = resolve;
        });
      } else if (message.type === "refresh-done") {
        if (resolveCrossTabRefresh !== null) {
          resolveCrossTabRefresh(message.success);
          resolveCrossTabRefresh = null;
          crossTabRefreshPromise = null;
        }
        if (!message.success) {
          notifyRefreshFail();
        }
      }
    });
  }
  return channel;
}

// ---------------------------------------------------------------------------
// Refresh-fail listeners
// ---------------------------------------------------------------------------

function notifyRefreshFail(): void {
  for (const listener of refreshFailListeners) {
    listener();
  }
}

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

// ---------------------------------------------------------------------------
// Token refresh (single-tab dedup + cross-tab coordination)
// ---------------------------------------------------------------------------

async function attemptTokenRefresh(): Promise<boolean> {
  // If this tab is already refreshing, piggyback on it
  if (refreshPromise !== null) {
    return refreshPromise;
  }

  // If another tab is refreshing, wait for its result
  if (crossTabRefreshPromise !== null) {
    return crossTabRefreshPromise;
  }

  // This tab will perform the refresh — notify other tabs
  getChannel()?.postMessage({ type: "refresh-start" } satisfies RefreshMessage);

  refreshPromise = fetch("/api/auth/refresh", { method: "POST" })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  const success = await refreshPromise;

  // Notify other tabs of the result
  getChannel()?.postMessage({ type: "refresh-done", success } satisfies RefreshMessage);

  if (!success) {
    notifyRefreshFail();
  }

  return success;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
