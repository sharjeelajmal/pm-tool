import Pusher from "pusher-js";

let pusher: Pusher | null = null;

// One socket per tab; each effect subscribes to the channels it needs and unsubscribes on cleanup.
export function getPusherClient() {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (typeof window === "undefined" || !key || !cluster) return null;
  pusher ??= new Pusher(key, {
    cluster,
    channelAuthorization: { endpoint: "/api/pusher/auth", transport: "ajax" },
  });
  return pusher;
}
