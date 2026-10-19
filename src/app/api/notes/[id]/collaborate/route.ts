import { fitsInEvent, realtimeHub } from "@/lib/realtimeHub";
import { getAuthPayload } from "@/lib/authUtil";
import { jsonResponse } from "@/lib/apiHeaders";
import { connectDB } from "@/lib/db";
import { Note } from "@/models/Note";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: noteId } = await context.params;
    const auth = await getAuthPayload();
    const username = auth.username || "Guest";
    const body = await request.json();

    if (!body || !body.action) {
      return jsonResponse({ success: false, error: "Action is required" }, 400);
    }

    if (body.action === "typing") {
      await realtimeHub.setActivity(noteId, username, "typing");
      return jsonResponse({ success: true }, 200);
    }

    if (body.action === "uploading") {
      await realtimeHub.setActivity(noteId, username, "uploading", { fileType: body.fileType || "media" });
      return jsonResponse({ success: true }, 200);
    }

    if (body.action === "content_update") {
      // Save before broadcasting: a note too big for one Pusher event is sent as a "reload" ping,
      // and listeners then fetch the saved copy.
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(noteId);
      if (isObjectId && (body.content !== undefined || body.title !== undefined)) {
        await connectDB();
        const updateFields: Record<string, unknown> = { updatedAt: new Date() };
        if (body.content !== undefined) updateFields.content = body.content;
        if (body.title !== undefined) updateFields.title = body.title;

        await Note.updateOne({ _id: noteId, portal: auth.portal }, updateFields);
      }

      const updatedAt = new Date().toISOString();
      const update = { username, content: body.content, title: body.title, updatedAt };
      await realtimeHub.broadcast(
        noteId,
        username,
        "content_update",
        fitsInEvent(update) ? update : { username, updatedAt, reload: true }
      );

      return jsonResponse({ success: true }, 200);
    }

    return jsonResponse({ success: false, error: "Unknown action" }, 400);
  } catch (error) {
    return jsonResponse({ success: false, error: "Failed to broadcast realtime event" }, 500);
  }
}
