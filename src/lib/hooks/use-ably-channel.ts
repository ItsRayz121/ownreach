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
    channel.subscribe(eventName, listener);

    return () => {
      channel.unsubscribe(eventName, listener);
    };
  }, [channelName, eventName]);
}
