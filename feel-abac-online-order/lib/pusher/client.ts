'use client';

import Pusher from "pusher-js";

let pusherClient: Pusher | null = null;
let warnedMissingEnv = false;

export function getPusherClient() {
  if (typeof window === "undefined") {
    throw new Error("getPusherClient must be used in the browser");
  }

  if (pusherClient) {
    return pusherClient;
  }

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) {
    if (!warnedMissingEnv) {
      console.warn(
        "[pusher-client] Missing NEXT_PUBLIC_PUSHER_KEY or NEXT_PUBLIC_PUSHER_CLUSTER; realtime disabled."
      );
      warnedMissingEnv = true;
    }
    return null;
  }

  if (process.env.NODE_ENV !== "production") {
    Pusher.logToConsole = true;
  }

  pusherClient = new Pusher(key, {
    cluster,
    forceTLS: true,
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
    },
  });

  return pusherClient;
}
