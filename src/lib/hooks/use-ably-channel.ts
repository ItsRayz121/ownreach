"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import * as Ably from "ably";

// One shared connection for the whole tab, created lazily on first use.
// Never throws when realtime isn't configured — the auth request to
// /api/realtime/token just fails, the connection sits in "failed" state, and
// every channel subscription silently receives nothing (see the token
// route's graceful-degradation contract).
let sharedClient: Ably.Realtime | null = null;

function getSharedClient(): Ably.Realtime {
  if (!sharedClient) {
    sharedClient = new Ably.Realtime({ authUrl: "/api/realtime/token" });
  }
  return sharedClient;
}

/** Subscribes to `eventName` on `channelName` for the lifetime of the component. Pass `null` to skip subscribing. */
export function useAblyChannel<T = unknown>(
  channelName: string | null,
  eventName: string,
  onMessage: (data: T) => void
): void {
  const handlerRef = useRef(onMessage);
  useLayoutEffect(() => {
    handlerRef.current = onMessage;
  });

  useEffect(() => {
    if (!channelName) return;

    const client = getSharedClient();
    const channel = client.channels.get(channelName);
    const listener = (message: Ably.Message) => handlerRef.current(message.data as T);
    let cancelled = false;

    // A channel/conversation created earlier in this tab session may not be in
    // the capability set baked into our current token — the shared client is
    // created once per tab and otherwise only re-authorizes on natural token
    // expiry. If the attach is denied, re-authorize once to pick up a fresh
    // capability set and retry, instead of silently missing realtime events
    // until the token's TTL runs out.
    channel.subscribe(eventName, listener).catch(() => {
      if (cancelled) return;
      client.auth
        .authorize()
        .then(() => {
          if (!cancelled) return channel.subscribe(eventName, listener);
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      channel.unsubscribe(eventName, listener);
    };
  }, [channelName, eventName]);
}
