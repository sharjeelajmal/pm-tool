export interface SSEClient {
  id: string;
  noteId: string;
  username: string;
  send: (eventType: string, data: any) => void;
}

export interface PresenceUser {
  username: string;
  status: "active" | "typing" | "uploading";
  lastSeen: number;
}

class RealtimeHub {
  private clients: Map<string, Set<SSEClient>> = new Map();
  private presence: Map<string, Map<string, PresenceUser>> = new Map();

  public subscribe(noteId: string, client: SSEClient) {
    if (!this.clients.has(noteId)) {
      this.clients.set(noteId, new Set());
    }
    this.clients.get(noteId)!.add(client);

    if (!this.presence.has(noteId)) {
      this.presence.set(noteId, new Map());
    }
    this.presence.get(noteId)!.set(client.username, {
      username: client.username,
      status: "active",
      lastSeen: Date.now(),
    });

    this.broadcastPresence(noteId);

    return () => {
      this.unsubscribe(noteId, client);
    };
  }

  public unsubscribe(noteId: string, client: SSEClient) {
    const noteClients = this.clients.get(noteId);
    if (noteClients) {
      noteClients.delete(client);
      if (noteClients.size === 0) {
        this.clients.delete(noteId);
      }
    }

    const hasOtherConnection = Array.from(this.clients.get(noteId) || []).some(
      (c) => c.username === client.username
    );

    if (!hasOtherConnection) {
      const notePresence = this.presence.get(noteId);
      if (notePresence) {
        notePresence.delete(client.username);
        if (notePresence.size === 0) {
          this.presence.delete(noteId);
        }
      }
    }

    this.broadcastPresence(noteId);
  }

  public setActivity(noteId: string, username: string, status: "active" | "typing" | "uploading") {
    const notePresence = this.presence.get(noteId);
    if (notePresence && notePresence.has(username)) {
      const user = notePresence.get(username)!;
      user.status = status;
      user.lastSeen = Date.now();
    }
  }

  public getActiveUsers(noteId: string): string[] {
    const notePresence = this.presence.get(noteId);
    if (!notePresence) return [];
    const now = Date.now();
    const result: string[] = [];
    notePresence.forEach((user, username) => {
      if (now - user.lastSeen < 60000) {
        result.push(username);
      }
    });
    return result;
  }

  public broadcast(noteId: string, senderUsername: string, eventType: string, data: any) {
    const noteClients = this.clients.get(noteId);
    if (!noteClients) return;

    noteClients.forEach((client) => {
      if (client.username !== senderUsername) {
        try {
          client.send(eventType, data);
        } catch {}
      }
    });
  }

  public broadcastToAll(noteId: string, eventType: string, data: any) {
    const noteClients = this.clients.get(noteId);
    if (!noteClients) return;

    noteClients.forEach((client) => {
      try {
        client.send(eventType, data);
      } catch {}
    });
  }

  public broadcastPresence(noteId: string) {
    const users = this.getActiveUsers(noteId);
    this.broadcastToAll(noteId, "presence", { users });
  }

  private userClients: Map<string, Set<SSEClient>> = new Map();

  public subscribeUser(username: string, client: SSEClient) {
    if (!this.userClients.has(username)) {
      this.userClients.set(username, new Set());
    }
    this.userClients.get(username)!.add(client);
    this.broadcastGlobalPresence();

    return () => {
      this.unsubscribeUser(username, client);
    };
  }

  public unsubscribeUser(username: string, client: SSEClient) {
    const clients = this.userClients.get(username);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.userClients.delete(username);
      }
    }
    this.broadcastGlobalPresence();
  }

  public getOnlineUsers(): string[] {
    return Array.from(this.userClients.keys());
  }

  public isUserOnline(username: string): boolean {
    const clients = this.userClients.get(username);
    return !!(clients && clients.size > 0);
  }

  public broadcastGlobalPresence() {
    const onlineUsers = this.getOnlineUsers();
    this.userClients.forEach((clients) => {
      clients.forEach((client) => {
        try {
          client.send("global_presence", { onlineUsers });
        } catch {}
      });
    });
  }

  public broadcastToAllUsers(eventType: string, data: any) {
    this.userClients.forEach((clients) => {
      clients.forEach((client) => {
        try {
          client.send(eventType, data);
        } catch {}
      });
    });
  }

  public sendToUser(username: string, eventType: string, data: any) {
    const target = (username || "").toLowerCase().trim();
    this.userClients.forEach((clients, u) => {
      if (u.toLowerCase().trim() === target) {
        clients.forEach((client) => {
          try {
            client.send(eventType, data);
          } catch {}
        });
      }
    });
  }
}

const globalForRealtime = globalThis as unknown as { realtimeHub?: RealtimeHub };

export const realtimeHub = globalForRealtime.realtimeHub || new RealtimeHub();

if (process.env.NODE_ENV !== "production") {
  globalForRealtime.realtimeHub = realtimeHub;
}
