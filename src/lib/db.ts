import mongoose from "mongoose";
import dns from "dns";

if (process.env.NODE_ENV === "development") {
  try {
    const servers = dns.getServers();
    if (!servers || servers.length === 0 || servers.includes("127.0.0.1")) {
      dns.setServers(["8.8.8.8", "1.1.1.1"]);
    }
  } catch (e) {
    console.warn("Failed to set fallback DNS servers:", e);
  }
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = globalThis.mongooseCache ?? { conn: null, promise: null };
globalThis.mongooseCache = cached;

export async function connectDB(): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured on the server");
  }

  if (cached.conn) {
    if (cached.conn.connection.readyState === 1) {
      return cached.conn;
    }
    if (cached.conn.connection.readyState === 0 || cached.conn.connection.readyState === 3) {
      cached.conn = null;
      cached.promise = null;
    }
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 2,
      minPoolSize: 0,
      maxIdleTimeMS: 10000,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 20000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    throw e;
  }

  return cached.conn;
}

