'use client';

import Pusher from "pusher-js";

let pusherClient: Pusher | null = null;

function getEnvOrThrow(value: string | undefined, key: string) {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing Pusher client env: ${key}`);
  }
  return value;
}

export function getPusherClient() {
  if (typeof window === "undefined") {
    throw new Error("getPusherClient must be used in the browser");
  }

  if (pusherClient) {
    return pusherClient;
  }

  const key = getEnvOrThrow(process.env.NEXT_PUBLIC_PUSHER_KEY, "NEXT_PUBLIC_PUSHER_KEY");
  const cluster = getEnvOrThrow(
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    "NEXT_PUBLIC_PUSHER_CLUSTER"
  );

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
