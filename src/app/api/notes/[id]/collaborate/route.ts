import { realtimeHub } from "@/lib/realtimeHub";
import { getAuthPayload } from "@/lib/authUtil";
import { jsonResponse } from "@/lib/apiHeaders";
import { connectDB } from "@/lib/db";
import { Note } from "@/models/Note";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: noteId } = await context.params;
    const auth = await getAuthPayload();
    const username = auth.username || "Guest";

    const encoder = new TextEncoder();
    let isClosed = false;

    const stream = new ReadableStream({
      start(controller) {
        const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        const send = (eventType: string, data: any) => {
          if (isClosed) return;
          try {
            const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(payload));
          } catch {}
        };

        const unsubscribe = realtimeHub.subscribe(noteId, {
          id: clientId,
          noteId,
          username,
          send,
        });

        const activeUsers = realtimeHub.getActiveUsers(noteId);
        send("presence", { users: activeUsers });

        const heartbeat = setInterval(() => {
          if (isClosed) {
            clearInterval(heartbeat);
            return;
          }
          try {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {
            clearInterval(heartbeat);
          }
        }, 15000);

        request.signal.addEventListener("abort", () => {
          isClosed = true;
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return jsonResponse({ success: false, error: "Failed to establish realtime connection" }, 500);
  }
}

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
      realtimeHub.setActivity(noteId, username, "typing");
      realtimeHub.broadcast(noteId, username, "typing", { username });
      return jsonResponse({ success: true }, 200);
    }

    if (body.action === "uploading") {
      realtimeHub.setActivity(noteId, username, "uploading");
      realtimeHub.broadcast(noteId, username, "uploading", {
        username,
        fileType: body.fileType || "media",
      });
      return jsonResponse({ success: true }, 200);
    }

    if (body.action === "content_update") {
      realtimeHub.setActivity(noteId, username, "active");
      realtimeHub.broadcast(noteId, username, "content_update", {
        username,
        content: body.content,
        title: body.title,
        updatedAt: new Date().toISOString(),
      });

      const isObjectId = /^[0-9a-fA-F]{24}$/.test(noteId);
      if (isObjectId && (body.content !== undefined || body.title !== undefined)) {
        await connectDB();
        const updateFields: Record<string, unknown> = { updatedAt: new Date() };
        if (body.content !== undefined) updateFields.content = body.content;
        if (body.title !== undefined) updateFields.title = body.title;

        await Note.findOneAndUpdate(
          { _id: noteId, portal: auth.portal },
          updateFields,
          { new: true }
        );
      }

      return jsonResponse({ success: true }, 200);
    }

    return jsonResponse({ success: false, error: "Unknown action" }, 400);
  } catch (error) {
    return jsonResponse({ success: false, error: "Failed to broadcast realtime event" }, 500);
  }
}
