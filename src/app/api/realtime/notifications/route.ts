import { getAuthPayload } from "@/lib/authUtil";
import { realtimeHub } from "@/lib/realtimeHub";
import { jsonResponse } from "@/lib/apiHeaders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await getAuthPayload();
    const username = auth.username;

    if (!username) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const encoder = new TextEncoder();
    let isClosed = false;

    const stream = new ReadableStream({
      start(controller) {
        const clientId = `user-notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        const send = (eventType: string, data: any) => {
          if (isClosed) return;
          try {
            const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(payload));
          } catch {}
        };

        const unsubscribe = realtimeHub.subscribeUser(username, {
          id: clientId,
          noteId: "global-notifications",
          username,
          send,
        });

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
    console.error("Failed to start notification stream:", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      500
    );
  }
}
