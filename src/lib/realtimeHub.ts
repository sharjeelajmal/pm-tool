import Pusher from "pusher";
import { noteChannel, onlineChannel, userChannel } from "@/lib/realtimeChannels";

// Pusher rejects events whose data is 10KB or more.
const MAX_EVENT_BYTES = 10_000;

let pusher: Pusher | null | undefined;

export function getPusherServer() {
  if (pusher === undefined) {
    const { PUSHER_APP_ID: appId, PUSHER_KEY: key, PUSHER_SECRET: secret, PUSHER_CLUSTER: cluster } = process.env;
    pusher = appId && key && secret && cluster ? new Pusher({ appId, key, secret, cluster, useTLS: true }) : null;
    if (!pusher) console.warn("Pusher env vars are missing; realtime events are disabled.");
  }
  return pusher;
}

export function fitsInEvent(data: unknown) {
  return Buffer.byteLength(JSON.stringify(data)) < MAX_EVENT_BYTES;
}

// Stateless: presence lives in Pusher presence channels, so nothing is kept in memory here.
class RealtimeHub {
  private async trigger(channel: string, eventType: string, data: unknown) {
    const client = getPusherServer();
    if (!client) return;
    try {
      await client.trigger(channel, eventType, data);
    } catch (error) {
      console.error(`Pusher trigger "${eventType}" on ${channel} failed:`, error);
    }
  }

  private async channelUsers(channel: string): Promise<string[]> {
    const client = getPusherServer();
    if (!client) return [];
    try {
      const res = await client.get({ path: `/channels/${channel}/users` });
      if (!res.ok) return [];
      const body = (await res.json()) as { users?: { id: string }[] };
      return (body.users || []).map((u) => u.id);
    } catch {
      return [];
    }
  }

  // Pusher can't skip one user server-side; every client handler ignores events carrying its own username.
  public broadcast(noteId: string, senderUsername: string, eventType: string, data: unknown) {
    return this.trigger(noteChannel(noteId), eventType, data);
  }

  public broadcastToAll(noteId: string, eventType: string, data: unknown) {
    return this.trigger(noteChannel(noteId), eventType, data);
  }

  public setActivity(noteId: string, username: string, status: "typing" | "uploading", extra: Record<string, unknown> = {}) {
    return this.trigger(noteChannel(noteId), status, { ...extra, username });
  }

  public getActiveUsers(noteId: string) {
    return this.channelUsers(noteChannel(noteId));
  }

  public async broadcastPresence(noteId: string) {
    const users = await this.getActiveUsers(noteId);
    await this.trigger(noteChannel(noteId), "presence", { users });
  }

  public getOnlineUsers(portal: string) {
    return this.channelUsers(onlineChannel(portal));
  }

  public async isUserOnline(portal: string, username: string) {
    const target = username.toLowerCase().trim();
    return (await this.getOnlineUsers(portal)).some((u) => u.toLowerCase().trim() === target);
  }

  public async broadcastGlobalPresence(portal: string) {
    const onlineUsers = await this.getOnlineUsers(portal);
    await this.trigger(onlineChannel(portal), "global_presence", { onlineUsers });
  }

  public broadcastToAllUsers(portal: string, eventType: string, data: unknown) {
    return this.trigger(onlineChannel(portal), eventType, data);
  }

  public sendToUser(username: string, eventType: string, data: unknown) {
    return this.trigger(userChannel(username), eventType, data);
  }
}

export const realtimeHub = new RealtimeHub();
