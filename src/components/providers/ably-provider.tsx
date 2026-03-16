"use client";

import * as Ably from "ably";
import { AblyProvider as AblyReactProvider, ChannelProvider, useChannel } from "ably/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";

import { useAuth } from "@/components/providers/auth-provider";
import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";

/**
 * Listens on the user's private Ably channel and revalidates SWR
 * caches when a real-time notification arrives. Renders nothing.
 * Must be rendered inside a ChannelProvider for the user's channel.
 */
function NotificationListener({ channelName }: Readonly<{ channelName: string }>) {
  const { mutate } = useSWRConfig();

  useChannel({ channelName }, "notification", () => {
    void mutate("/api/notifications/unread-count");
    void mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/notifications"));
  });

  return null;
}

/**
 * Wraps children with Ably real-time when the user is authenticated.
 * Falls through without the Ably wrapper during SSR or when logged out.
 */
export function AblyProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = useAuth();
  const clientRef = useRef<Ably.Realtime | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const client = useMemo(() => {
    if (!isMounted || user === null) return null;

    const instance = new Ably.Realtime({
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

    clientRef.current = instance;
    return instance;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recreate only when user identity changes or mount state changes
  }, [user?.id, isMounted]);

  // Clean up previous client when user changes or component unmounts
  useEffect(() => {
    return () => {
      if (clientRef.current !== null) {
        clientRef.current.close();
        clientRef.current = null;
      }
    };
  }, [client]);

  if (client === null) {
    return <>{children}</>;
  }

  const channelName = `user:${user?.id ?? ""}`;

  return (
    <AblyReactProvider client={client}>
      <ChannelProvider channelName={channelName}>
        <NotificationListener channelName={channelName} />
      </ChannelProvider>
      {children}
    </AblyReactProvider>
  );
}
