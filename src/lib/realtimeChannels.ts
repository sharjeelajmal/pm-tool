// Channel names shared by the server (realtimeHub) and the browser (pusherClient).
// Pusher only allows [A-Za-z0-9_\-=@,.;] in channel names.
const safe = (value: string) => value.replace(/[^A-Za-z0-9_\-=@,.;]/g, "_");

export const NOTE_CHANNEL_PREFIX = "presence-note-";

// Everyone signed in to a portal; its member list is the "online users" list.
export const onlineChannel = (portal: string) => `presence-online-${safe(portal)}`;

// Collaborators on one note; its member list is who has the note open.
export const noteChannel = (noteId: string) => `${NOTE_CHANNEL_PREFIX}${safe(noteId)}`;

// Events meant for a single user.
export const userChannel = (username: string) => `private-user-${safe(username.toLowerCase().trim())}`;
