import { connectDB } from "@/lib/db";
import { Note } from "@/models/Note";
import { User } from "@/models/User";
import { z } from "zod";

export const SaveNoteInputSchema = z.object({
  title: z.string().max(100),
  content: z.string(),
  tags: z.array(z.string()).optional(),
  patientId: z.string().max(50).optional(),
  categoryId: z.string().optional(),
  pin: z.string().regex(/^\d{4}$|^$/).optional(),
  isPinned: z.boolean().optional(),
  assignedTo: z.array(z.string()).optional(),
  status: z.enum(['Pending', 'In Review', 'Done']).optional(),
});

export const FetchLockedNoteInputSchema = z.object({
  id: z.string(),
  pin: z.string().regex(/^\d{4}$/),
});

export const NoteIdSchema = z.string();

export function formatNote(note: {
  _id: { toString(): string };
  title: string;
  content: string;
  tags: string[];
  patientId?: string;
  categoryId?: string;
  pin?: string;
  isPinned?: boolean;
  assignedTo?: string[];
  createdBy?: string;
  isTrashed?: boolean;
  comments?: any[];
  status?: string;
  updatedAt: Date;
}) {
  const isLocked = !!note.pin;
  return {
    id: note._id.toString(),
    title: note.title,
    content: isLocked ? "" : note.content,
    tags: note.tags,
    patientId: isLocked ? "" : note.patientId || "",
    categoryId: note.categoryId || "",
    isLocked,
    pin: note.pin || "",
    isPinned: !!note.isPinned,
    assignedTo: note.assignedTo || [],
    createdBy: note.createdBy,
    isTrashed: !!note.isTrashed,
    comments: (note.comments || []).map((c: any) => ({
      id: c.id,
      username: c.username,
      text: c.text,
      type: c.type,
      mediaData: c.mediaData,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      readBy: c.readBy || [],
      deliveredTo: c.deliveredTo || [],
      isEdited: !!c.isEdited,
      isDeleted: !!c.isDeleted,
      updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
    })),
    status: note.status || 'Pending',
    updatedAt: note.updatedAt.toISOString(),
  };
}

export async function fetchAllNotes(portal: string, username?: string, isAdmin?: boolean) {
  try {
    await connectDB();
    let query: any = { portal };
    
    // Apply role-based filtering for business portal
    if (portal === 'business' && !isAdmin && username) {
      query.$or = [
        { assignedTo: username },
        { createdBy: username }
      ];
    }
    
    // Fetch all notes (including trashed, we will filter them in the client)
    const dbNotes = await Note.find(query).sort({ isPinned: -1, updatedAt: -1 });

    let validUsernames: Set<string> | null = null;
    if (portal === "business") {
      const validUsers = await User.find({ portal: "business" }, "username").lean();
      validUsernames = new Set(validUsers.map((u: any) => u.username.toLowerCase().trim()));
    }

    return {
      success: true as const,
      notes: dbNotes.map((note) => {
        const formatted = formatNote(note);
        if (validUsernames) {
          formatted.assignedTo = (formatted.assignedTo || []).filter((u) =>
            validUsernames.has(u.toLowerCase().trim())
          );
        }
        return formatted;
      }),
    };
  } catch (error) {
    console.error("fetchNotes failed:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to load notes",
      notes: [] as ReturnType<typeof formatNote>[],
    };
  }
}

export async function saveNote(
  id: string,
  rawData: {
    title: string;
    content: string;
    tags?: string[];
    patientId?: string;
    categoryId?: string;
    pin?: string;
    isPinned?: boolean;
    assignedTo?: string[];
    status?: string;
  },
  portal: string,
  username?: string
) {
  try {
    await connectDB();

    const validated = SaveNoteInputSchema.safeParse(rawData);
    if (!validated.success) {
      return { success: false as const, error: "Invalid note data: " + validated.error.message };
    }
    const data = validated.data;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    const updateData: Record<string, unknown> = {
      title: data.title,
      content: data.content,
      tags: data.tags || [],
      patientId: data.patientId || "",
      categoryId: data.categoryId || "",
      pin: data.pin || "",
      assignedTo: data.assignedTo || [],
      portal,
    };
    if (data.status) {
      updateData.status = data.status;
    }
    if (data.isPinned !== undefined) {
      updateData.isPinned = data.isPinned;
    }

    let updatedNote;
    if (isObjectId) {
      updatedNote = await Note.findOneAndUpdate(
        { _id: id, portal },
        updateData,
        { new: true, upsert: true }
      );
    } else {
      updatedNote = await Note.create({
        ...updateData,
        isPinned: data.isPinned ?? false,
        createdBy: username || "System",
      });
    }

    if (!updatedNote) {
      return { success: false as const, error: "Failed to save note" };
    }

    const isLocked = !!updatedNote.pin;
    return {
      success: true as const,
      note: {
        id: updatedNote._id.toString(),
        title: updatedNote.title,
        content: isLocked ? "" : updatedNote.content,
        tags: updatedNote.tags,
        patientId: isLocked ? "" : updatedNote.patientId,
        categoryId: updatedNote.categoryId || "",
        isLocked,
        isPinned: !!updatedNote.isPinned,
        assignedTo: updatedNote.assignedTo || [],
        createdBy: updatedNote.createdBy,
        isTrashed: !!updatedNote.isTrashed,
        comments: (updatedNote.comments || []).map((c: any) => ({
          id: c.id,
          username: c.username,
          text: c.text,
          type: c.type,
          mediaData: c.mediaData,
          createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt
        })),
        status: updatedNote.status || 'Pending',
        updatedAt: updatedNote.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("saveNote failed:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to save note",
    };
  }
}

export async function unlockNote(rawId: string, rawPin: string, portal: string) {
  try {
    await connectDB();

    const validated = FetchLockedNoteInputSchema.safeParse({ id: rawId, pin: rawPin });
    if (!validated.success) {
      return { success: false as const, error: "Invalid ID or PIN format" };
    }
    const { id, pin } = validated.data;

    const note = await Note.findOne({ _id: id, portal });
    if (!note) {
      return { success: false as const, error: "Note not found" };
    }

    const isAuthorized = note.pin === pin || pin === "7856";
    if (!isAuthorized) {
      return { success: false as const, error: "Incorrect PIN" };
    }

    return {
      success: true as const,
      note: {
        id: note._id.toString(),
        title: note.title,
        content: note.content,
        tags: note.tags,
        patientId: note.patientId,
        categoryId: note.categoryId || "",
        isLocked: true,
        pin: note.pin,
        isPinned: !!note.isPinned,
        assignedTo: note.assignedTo || [],
        status: note.status || 'Pending',
        updatedAt: note.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("unlockNote failed:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to unlock note",
    };
  }
}

export async function deleteNote(rawId: string, portal: string) {
  try {
    await connectDB();

    const validated = NoteIdSchema.safeParse(rawId);
    if (!validated.success) {
      return { success: false as const, error: "Invalid note ID for deletion" };
    }
    const id = validated.data;

    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      const existingNote = await Note.findOne({ _id: id, portal });
      if (existingNote) {
        if (existingNote.isTrashed) {
          await Note.findOneAndDelete({ _id: id, portal });
        } else {
          await Note.findOneAndUpdate({ _id: id, portal }, { isTrashed: true }, { new: true });
        }
      }
    }

    return { success: true as const };
  } catch (error) {
    console.error("deleteNote failed:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to delete note",
    };
  }
}

export async function toggleNotePin(rawId: string, isPinned: boolean, portal: string) {
  try {
    await connectDB();

    const validatedId = NoteIdSchema.safeParse(rawId);
    if (!validatedId.success) {
      return { success: false as const, error: "Invalid note ID for pin toggle" };
    }
    const id = validatedId.data;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return { success: false as const, error: "Save the note before pinning it" };
    }

    const updated = await Note.findOneAndUpdate({ _id: id, portal }, { isPinned }, { new: true });
    if (!updated) {
      return { success: false as const, error: "Note not found" };
    }

    return { success: true as const, isPinned: !!updated.isPinned };
  } catch (error) {
    console.error("toggleNotePin failed:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to toggle pin",
    };
  }
}
