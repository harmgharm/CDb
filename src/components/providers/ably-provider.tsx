"use client";

import * as Ably from "ably";
import {
  AblyProvider as AblyReactProvider,
  ChannelProvider,
  useChannel,
  usePresence,
} from "ably/react";
import { useEffect, useSyncExternalStore } from "react";
import { useSWRConfig } from "swr";

import { useAuth } from "@/components/providers/auth-provider";
import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";

const PRESENCE_CHANNEL = "presence:group";

/* ------------------------------------------------------------------ */
/*  Tiny external store for the Ably Realtime client                  */
/*                                                                    */
/*  Keeps client creation/teardown outside React's render cycle so    */
/*  React StrictMode's double-invoke of hooks never closes an active  */
/*  connection (which previously caused "Connection closed" errors).  */
/* ------------------------------------------------------------------ */

let currentClient: Ably.Realtime | null = null;
let currentUserId: string | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): Ably.Realtime | null {
  return currentClient;
}

function getServerSnapshot(): Ably.Realtime | null {
  return null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function createAblyClient(): Ably.Realtime {
  return new Ably.Realtime({
    authCallback: (_params, callback) => {
      void (async () => {
        try {
          const response = await fetchWithAuth("/api/ably/auth");
          const json = (await response.json()) as ApiResponse<Ably.TokenRequest>;
          if (json.error !== null) {
            callback(json.error, null);
            return;
          }
          callback(null, json.data);
        } catch {
          callback("Ably auth failed", null);
        }
      })();
    },
    autoConnect: true,
  });
}

/**
 * Create the Ably client for a given userId if one doesn't already exist.
 * Safe to call during render — only does instantiation, no teardown.
 */
function ensureClient(userId: string | null): void {
  if (userId === currentUserId) return;

  currentUserId = userId;

  if (userId !== null && currentClient === null) {
    currentClient = createAblyClient();
  }
}

/**
 * Tear down the current Ably client. Must only be called from effects
 * or event handlers — never during render, because `.close()` triggers
 * Ably internal cleanup that can cause state updates in child components.
 */
function teardownClient(): void {
  if (currentClient !== null) {
    currentClient.close();
    currentClient = null;
  }
  currentUserId = null;
  emitChange();
}

/* ------------------------------------------------------------------ */

/**
 * Listens on the user's private Ably channel and revalidates SWR
 * caches when a real-time notification arrives. Renders nothing.
 * Must be rendered inside a ChannelProvider for the user's channel.
 */
function NotificationListener({ channelName }: Readonly<{ channelName: string }>) {
  const { mutate } = useSWRConfig();

  useChannel({ channelName }, "notification", () => {
    // Optimistically bump the unread count so the badge updates instantly,
    // then revalidate in the background to get the true count from the DB.
    void mutate(
      "/api/notifications/unread-count",
      (current: { count: number } | undefined) => ({
        count: (current?.count ?? 0) + 1,
      }),
      { revalidate: true },
    );
    void mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/notifications"));
  });

  return null;
}

/**
 * Enters presence on the group channel with user metadata.
 * Must be rendered inside a ChannelProvider for "presence:group".
 */
function PresenceEntry() {
  const { user } = useAuth();

  usePresence(PRESENCE_CHANNEL, {
    userId: user?.id ?? "",
    username: user?.username ?? "",
    displayName: user?.displayName ?? null,
    avatarUrl: user?.avatarUrl ?? null,
  });

  return null;
}

/**
 * Wraps children with Ably real-time when the user is authenticated.
 * Falls through without the Ably wrapper during SSR or when logged out.
 *
 * Uses an external store + useSyncExternalStore to keep client lifecycle
 * outside React's render cycle, which avoids both:
 * - "Connection closed" errors from StrictMode double-invoking useMemo
 * - react-hooks/set-state-in-effect violations from setState in useEffect
 */
export function AblyProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Synchronously ensure a client exists for the current userId so the
  // very first render already has the correct client. This only creates
  // — it never tears down, so no side-effects during render.
  ensureClient(userId);

  const client = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Tear down when userId becomes null (logout).
  // Runs *after* render so .close() side-effects are safe.
  // No cleanup — we don't want StrictMode's double-invoke to close the
  // connection that ensureClient just created.
  useEffect(() => {
    if (userId === null) {
      teardownClient();
    }
  }, [userId]);

  // Clean up on true unmount only (empty deps = runs once).
  useEffect(() => {
    return () => {
      teardownClient();
    };
  }, []);

  if (client === null) {
    return <>{children}</>;
  }

  const channelName = `user:${userId ?? ""}`;

  return (
    <AblyReactProvider client={client}>
      <ChannelProvider channelName={channelName}>
        <NotificationListener channelName={channelName} />
      </ChannelProvider>
      <ChannelProvider channelName={PRESENCE_CHANNEL}>
        <PresenceEntry />
        {children}
      </ChannelProvider>
    </AblyReactProvider>
  );
}

export { PRESENCE_CHANNEL };
