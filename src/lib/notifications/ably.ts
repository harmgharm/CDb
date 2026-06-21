/**
 * Server-side Ably client
 *
 * Uses Ably.Rest (not Realtime) — the server only publishes,
 * never subscribes. Each publish is a single HTTP request.
 */

import Ably from "ably";

import { env } from "@/lib/env";
import { QUEUE_CHANNEL } from "@/lib/queue/realtime";

// Lazy singleton — Ably.Rest is lightweight, no persistent connection
let ablyClient: Ably.Rest | null = null;

function getAblyClient(): Ably.Rest {
  ablyClient ??= new Ably.Rest({ key: env.ABLY_API_KEY });
  return ablyClient;
}

/**
 * Publish an event to a user's private channel (fire-and-forget).
 */
export function publishToUser(userId: string, event: string, data: unknown): void {
  const client = getAblyClient();
  const channel = client.channels.get(`user:${userId}`);
  void channel.publish(event, data).catch((error: unknown) => {
    console.error(`Failed to publish ${event} to user:${userId}:`, error);
  });
}

/**
 * Publish an event to a game channel (fire-and-forget).
 */
export function publishToGame(gameId: string, event: string, data: unknown): void {
  const client = getAblyClient();
  const channel = client.channels.get(`game:${gameId}`);
  void channel.publish(event, data).catch((error: unknown) => {
    console.error(`Failed to publish ${event} to game:${gameId}:`, error);
  });
}

/**
 * Publish an event to a game channel and await delivery.
 *
 * Use for critical events (round-ended, round-started, game-ended) where
 * fire-and-forget risks the serverless function terminating before the
 * publish HTTP request completes.
 */
export async function publishToGameAsync(
  gameId: string,
  event: string,
  data: unknown,
): Promise<void> {
  const client = getAblyClient();
  const channel = client.channels.get(`game:${gameId}`);
  try {
    await channel.publish(event, data);
  } catch (error: unknown) {
    console.error(`Failed to publish ${event} to game:${gameId}:`, error);
  }
}

/**
 * Publish an event to the group queue channel (fire-and-forget).
 *
 * Used for the low-stakes queue events (proposed/voted/scheduled/removed): a
 * dropped publish re-syncs on the next load. The high-stakes `queue:advanced`
 * uses the awaited variant below.
 */
export function publishToQueue(event: string, data: unknown): void {
  const client = getAblyClient();
  const channel = client.channels.get(QUEUE_CHANNEL);
  void channel.publish(event, data).catch((error: unknown) => {
    console.error(`Failed to publish ${event} to ${QUEUE_CHANNEL}:`, error);
  });
}

/**
 * Publish an event to the group queue channel and await delivery.
 *
 * Use for `queue:advanced`, where fire-and-forget risks the serverless function
 * terminating before the publish HTTP request completes — leaving everyone on a
 * stale scheduled pick.
 */
export async function publishToQueueAsync(event: string, data: unknown): Promise<void> {
  const client = getAblyClient();
  const channel = client.channels.get(QUEUE_CHANNEL);
  try {
    await channel.publish(event, data);
  } catch (error: unknown) {
    console.error(`Failed to publish ${event} to ${QUEUE_CHANNEL}:`, error);
  }
}

/**
 * Create a signed token request scoped to a user's channel (subscribe-only).
 * Returned to the client via /api/ably/auth so the API key is never exposed.
 */
export async function createTokenRequest(userId: string): Promise<Ably.TokenRequest> {
  const client = getAblyClient();
  return client.auth.createTokenRequest({
    clientId: userId,
    capability: {
      [`user:${userId}`]: ["subscribe"],
      "presence:group": ["presence", "subscribe"],
      "game:*": ["publish", "subscribe", "presence"],
      [QUEUE_CHANNEL]: ["subscribe"],
    },
  });
}
