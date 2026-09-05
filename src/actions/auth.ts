"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export async function login(formData: FormData) {
  try {
    const rawUsername = formData.get("username") as string;
    const rawPassword = formData.get("password") as string;

    const username = rawUsername ? rawUsername.trim() : "";
    const password = rawPassword ? rawPassword.trim() : "";

    const validPersonalUsername = (process.env.PERSONAL_USERNAME || "admin").trim();
    const validPersonalPassword = (process.env.PERSONAL_PASSWORD || "admin").trim();
    
    const validBusinessUsername = (process.env.BUSINESS_USERNAME || "business").trim();
    const validBusinessPassword = (process.env.BUSINESS_PASSWORD || "business").trim();

    let authPayload: { portal: string, username: string, isAdmin: boolean } | null = null;
    
    if (username.toLowerCase() === validPersonalUsername.toLowerCase() && password === validPersonalPassword) {
      authPayload = { portal: "personal", username: validPersonalUsername, isAdmin: true };
    } else if (username.toLowerCase() === validBusinessUsername.toLowerCase() && password === validBusinessPassword) {
      authPayload = { portal: "business", username: validBusinessUsername, isAdmin: true };
    } else {
      // Check database for dynamically created business users
      try {
        await connectDB();
        const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const user = await User.findOne({
          username: { $regex: new RegExp(`^${escapedUsername}$`, "i") },
          password: password,
          portal: "business",
        });

        if (user) {
          authPayload = { portal: "business", username: user.username, isAdmin: false };
        }
      } catch (error) {
        console.error("DB auth query error:", error);
      }
    }

    if (authPayload) {
      const cookieStore = await cookies();
      cookieStore.set("auth_token", encodeURIComponent(JSON.stringify(authPayload)), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/",
      });
      
      return { success: true };
    } else {
      return { error: "Invalid username or password" };
    }
  } catch (err) {
    console.error("Login Server Action exception:", err);
    return { error: "Authentication failed. Please try again." };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("auth_token");
  cookieStore.set("auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  redirect("/login");
}


