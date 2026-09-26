import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Note } from "@/models/Note";
import { realtimeHub } from "@/lib/realtimeHub";
import { z } from "zod";

export const CreateUserSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(4),
});

export const UpdateUserSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(4),
});

export async function fetchUsers() {
  try {
    await connectDB();
    const users = await User.find({ portal: "business" }).sort({ createdAt: -1 });
    return {
      success: true as const,
      users: users.map((u) => ({
        id: u._id.toString(),
        username: u.username,
        password: u.password,
      })),
    };
  } catch (error) {
    console.error("fetchUsers failed:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to load users",
      users: [],
    };
  }
}

export async function createUser(data: z.infer<typeof CreateUserSchema>) {
  try {
    await connectDB();
    const validated = CreateUserSchema.safeParse(data);
    if (!validated.success) {
      return { success: false as const, error: "Invalid user data" };
    }

    const cleanUsername = validated.data.username.trim();
    const cleanPassword = validated.data.password.trim();

    const escapedUsername = cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existing = await User.findOne({
      username: { $regex: new RegExp(`^${escapedUsername}$`, "i") },
    });
    if (existing) {
      return { success: false as const, error: "Username already exists" };
    }

    const newUser = await User.create({
      username: cleanUsername,
      password: cleanPassword,
      portal: "business",
    });

    return {
      success: true as const,
      user: {
        id: newUser._id.toString(),
        username: newUser.username,
        password: newUser.password,
      },
    };
  } catch (error) {
    console.error("createUser failed:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to create user",
    };
  }
}

export async function updateUser(id: string, data: z.infer<typeof UpdateUserSchema>) {
  try {
    await connectDB();
    const validated = UpdateUserSchema.safeParse(data);
    if (!validated.success) {
      return { success: false as const, error: "Invalid user data" };
    }

    const cleanUsername = validated.data.username.trim();
    const cleanPassword = validated.data.password.trim();

    // Check if new username is taken by another user
    const escapedUsername = cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existing = await User.findOne({
      username: { $regex: new RegExp(`^${escapedUsername}$`, "i") },
      _id: { $ne: id },
    });
    if (existing) {
      return { success: false as const, error: "Username already exists" };
    }

    const updated = await User.findOneAndUpdate(
      { _id: id, portal: "business" },
      { username: cleanUsername, password: cleanPassword },
      { new: true }
    );

    if (!updated) return { success: false as const, error: "User not found" };

    return {
      success: true as const,
      user: {
        id: updated._id.toString(),
        username: updated.username,
        password: updated.password,
      },
    };
  } catch (error) {
    console.error("updateUser failed:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to update user",
    };
  }
}

export async function deleteUser(id: string) {
  try {
    await connectDB();
    const deleted = await User.findOneAndDelete({ _id: id, portal: "business" });
    if (!deleted) return { success: false as const, error: "User not found" };

    const deletedUsername = deleted.username;

    await Note.updateMany(
      { portal: "business" },
      { $pull: { assignedTo: deletedUsername } }
    );

    realtimeHub.broadcastToAllUsers("user_deleted", { username: deletedUsername });

    return { success: true as const, username: deletedUsername };
  } catch (error) {
    console.error("deleteUser failed:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to delete user",
    };
  }
}
