import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  // Don't crash the Next.js dev server when env is missing — surface a helpful message instead.
  // In production we still want a hard failure, but during local development allow the app
  // to continue so pages that don't require the DB can render.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Please define the MONGODB_URI environment variable");
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "MONGODB_URI is not set. Database connections will be skipped in development."
    );
  }
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function dbConnect() {
  if (cached.conn) return cached.conn;

  // If there's no URI (development) skip attempting to connect.
  if (!MONGODB_URI) return null as any;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI as string, {
        bufferCommands: false,
      })
      .then((mongoose) => mongoose)
      .catch((err) => {
        // Provide a clearer message for common DNS/connection issues and avoid
        // crashing the dev server. In production rethrow so deployment fails fast.
        // eslint-disable-next-line no-console
        console.error("Failed to connect to MongoDB:", err && err.message ? err.message : err);
        if (process.env.NODE_ENV === "production") {
          throw err;
        }
        // Reset promise so future attempts can retry.
        cached.promise = null;
        return null as any;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
