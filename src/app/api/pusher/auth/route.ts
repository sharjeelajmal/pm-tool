import { cookies } from "next/headers";
import { getAuthPayload, type AuthPayload } from "@/lib/authUtil";
import { jsonResponse } from "@/lib/apiHeaders";
import { connectDB } from "@/lib/db";
import { getPusherServer } from "@/lib/realtimeHub";
import { NOTE_CHANNEL_PREFIX, onlineChannel, userChannel } from "@/lib/realtimeChannels";
import { Note } from "@/models/Note";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function canJoin(channel: string, auth: AuthPayload) {
  if (channel === onlineChannel(auth.portal) || channel === userChannel(auth.username)) return true;
  if (!channel.startsWith(NOTE_CHANNEL_PREFIX)) return false;

  const noteId = channel.slice(NOTE_CHANNEL_PREFIX.length);
  // Notes that aren't saved yet only exist in the browser, so there's nothing to check them against.
  if (!/^[0-9a-fA-F]{24}$/.test(noteId)) return true;

  // Same visibility rule as fetchAllNotes: business members only see notes assigned to or created by them.
  const query: Record<string, unknown> = { _id: noteId, portal: auth.portal };
  if (auth.portal === "business" && !auth.isAdmin) {
    query.$or = [{ assignedTo: auth.username }, { createdBy: auth.username }];
  }
  await connectDB();
  return !!(await Note.exists(query));
}

// pusher-js posts socket_id + channel_name (form encoded) before joining a private or presence channel.
export async function POST(request: Request) {
  try {
    const pusher = getPusherServer();
    if (!pusher) {
      return jsonResponse({ success: false, error: "Realtime is not configured" }, 503);
    }

    const cookieStore = await cookies();
    const auth = await getAuthPayload();
    if (!cookieStore.get("auth_token")?.value || !auth.username || !auth.portal) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const form = new URLSearchParams(await request.text());
    const socketId = form.get("socket_id");
    const channel = form.get("channel_name");
    if (!socketId || !channel) {
      return jsonResponse({ success: false, error: "socket_id and channel_name are required" }, 400);
    }

    if (!(await canJoin(channel, auth))) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    const presence = channel.startsWith("presence-")
      ? { user_id: auth.username, user_info: { username: auth.username } }
      : undefined;
    return jsonResponse(pusher.authorizeChannel(socketId, channel, presence), 200);
  } catch (error) {
    console.error("Pusher auth failed:", error);
    return jsonResponse({ success: false, error: "Failed to authorize realtime channel" }, 500);
  }
}
