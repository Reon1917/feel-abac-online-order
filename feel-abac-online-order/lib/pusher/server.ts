import "server-only";

import Pusher from "pusher";

let pusherServer: Pusher | null = null;

function assertEnv(value: string | undefined, key: string) {
  if (!value) {
    throw new Error(`Missing Pusher env: ${key}`);
  }
  return value;
}

export function getPusherServer() {
  if (pusherServer) {
    return pusherServer;
  }

  const appId = assertEnv(process.env.PUSHER_APP_ID, "PUSHER_APP_ID");
  const key = assertEnv(process.env.PUSHER_KEY, "PUSHER_KEY");
  const secret = assertEnv(process.env.PUSHER_SECRET, "PUSHER_SECRET");
  const cluster = assertEnv(process.env.PUSHER_CLUSTER, "PUSHER_CLUSTER");

  pusherServer = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return pusherServer;
}
