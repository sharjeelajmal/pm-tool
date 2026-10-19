import { connectDB } from "@/lib/db";
import { Note } from "@/models/Note";
import { jsonResponse } from "@/lib/apiHeaders";
import { getAuthPayload } from "@/lib/authUtil";
import { realtimeHub } from "@/lib/realtimeHub";
import mongoose from "mongoose";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const auth = await getAuthPayload();
    const portal = auth.portal;
    const username = auth.username;

    if (!username) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const { text, type = 'text', mediaData } = await request.json();
    if (type === 'text' && (!text || typeof text !== "string" || text.trim() === "")) {
      return jsonResponse({ success: false, error: "Invalid comment text" }, 400);
    }

    await connectDB();

    const [activeUsers, onlineUsers] = await Promise.all([
      realtimeHub.getActiveUsers(id),
      realtimeHub.getOnlineUsers(portal),
    ]);
    const deliveredSet = new Set<string>([username, ...activeUsers, ...onlineUsers]);

    const newComment = {
      id: "cmt-" + Date.now().toString(),
      username,
      text: text ? text.trim() : "",
      type,
      mediaData,
      createdAt: new Date(),
      readBy: [username],
      deliveredTo: Array.from(deliveredSet),
      isEdited: false,
      isDeleted: false,
    };

    const note = await Note.findOneAndUpdate(
      { _id: id, portal },
      { $push: { comments: newComment } },
      { new: true }
    );

    if (!note) {
      return jsonResponse({ success: false, error: "Note not found" }, 404);
    }

    await realtimeHub.broadcast(id, username, "comment_added", { comment: newComment });

    const previewText =
      type === "audio"
        ? "Sent a voice note 🎙️"
        : type === "image"
        ? "Shared an image 📷"
        : newComment.text;

    await realtimeHub.broadcastToAllUsers(portal, "assigned_note_message", {
      noteId: id,
      noteTitle: note.title || "Untitled Note",
      sender: username,
      text: previewText,
      type: newComment.type,
      comment: newComment,
      assignedTo: note.assignedTo || [],
      createdBy: note.createdBy || "",
      createdAt: newComment.createdAt.toISOString(),
    });

    return jsonResponse({
      success: true,
      comment: newComment,
    });
  } catch (error) {
    console.error("Failed to add comment:", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      500
    );
  }
}

export async function PUT(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const auth = await getAuthPayload();
    const portal = auth.portal;
    const username = auth.username;

    if (!username) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const { commentId, text } = await request.json();
    if (!commentId || !text || typeof text !== "string" || text.trim() === "") {
      return jsonResponse({ success: false, error: "Invalid comment text" }, 400);
    }

    await connectDB();
    const note = await Note.findOne({ _id: id, portal });
    if (!note) {
      return jsonResponse({ success: false, error: "Note not found" }, 404);
    }

    const comment = note.comments?.find((c: any) => c.id === commentId);
    if (!comment) {
      return jsonResponse({ success: false, error: "Comment not found" }, 404);
    }

    if (comment.username !== username) {
      return jsonResponse({ success: false, error: "Permission denied" }, 403);
    }

    if (comment.isDeleted) {
      return jsonResponse({ success: false, error: "Cannot edit a deleted message" }, 400);
    }

    const now = Date.now();
    const commentTime = new Date(comment.createdAt).getTime();
    const diffMinutes = (now - commentTime) / (1000 * 60);

    if (diffMinutes > 5) {
      return jsonResponse({ success: false, error: "Messages can only be edited within 5 minutes" }, 400);
    }

    const updatedText = text.trim();
    const updatedAt = new Date();

    await Note.updateOne(
      { _id: id, portal, "comments.id": commentId },
      {
        $set: {
          "comments.$.text": updatedText,
          "comments.$.isEdited": true,
          "comments.$.updatedAt": updatedAt,
        }
      }
    );

    await realtimeHub.broadcastToAll(id, "comment_edited", {
      commentId,
      text: updatedText,
      isEdited: true,
      updatedAt: updatedAt.toISOString(),
    });

    return jsonResponse({
      success: true,
      commentId,
      text: updatedText,
      isEdited: true,
      updatedAt: updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to edit comment:", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      500
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const auth = await getAuthPayload();
    const portal = auth.portal;
    const username = auth.username;

    if (!username) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const { searchParams } = new URL(request.url);
    let commentId = searchParams.get("commentId");
    if (!commentId) {
      try {
        const body = await request.json();
        commentId = body.commentId;
      } catch {}
    }

    if (!commentId) {
      return jsonResponse({ success: false, error: "Comment ID is required" }, 400);
    }

    await connectDB();
    const note = await Note.findOne({ _id: id, portal });
    if (!note) {
      return jsonResponse({ success: false, error: "Note not found" }, 404);
    }

    const comment = note.comments?.find((c: any) => c.id === commentId);
    if (!comment) {
      return jsonResponse({ success: false, error: "Comment not found" }, 404);
    }

    if (comment.username !== username) {
      return jsonResponse({ success: false, error: "Permission denied" }, 403);
    }

    const now = Date.now();
    const commentTime = new Date(comment.createdAt).getTime();
    const diffMinutes = (now - commentTime) / (1000 * 60);

    if (diffMinutes > 5) {
      return jsonResponse({ success: false, error: "Messages can only be deleted within 5 minutes" }, 400);
    }

    const deletedText = "This message was deleted";
    const updatedAt = new Date();

    await Note.updateOne(
      { _id: id, portal, "comments.id": commentId },
      {
        $set: {
          "comments.$.text": deletedText,
          "comments.$.isDeleted": true,
          "comments.$.mediaData": "",
          "comments.$.updatedAt": updatedAt,
        }
      }
    );

    await realtimeHub.broadcastToAll(id, "comment_deleted", {
      commentId,
      text: deletedText,
      isDeleted: true,
      updatedAt: updatedAt.toISOString(),
    });

    return jsonResponse({
      success: true,
      commentId,
      text: deletedText,
      isDeleted: true,
      updatedAt: updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to delete comment:", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      500
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const auth = await getAuthPayload();
    const portal = auth.portal;
    const username = auth.username;

    if (!username) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    await connectDB();
    const query: any = { portal };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query._id = new mongoose.Types.ObjectId(id);
    } else {
      query._id = id;
    }

    await Note.updateOne(
      query,
      {
        $addToSet: {
          "comments.$[].readBy": username,
          "comments.$[].deliveredTo": username,
        }
      }
    );

    await Promise.all([
      realtimeHub.broadcastToAll(id, "comments_read", { noteId: id, username }),
      realtimeHub.broadcastToAllUsers(portal, "comments_read_global", { noteId: id, username }),
    ]);

    return jsonResponse({ success: true, username });
  } catch (error) {
    console.error("Failed to mark comments as read:", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      500
    );
  }
}
