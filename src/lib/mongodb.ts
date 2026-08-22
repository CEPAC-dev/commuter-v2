import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose | null> | null;
};

const globalWithMongoose = global as typeof globalThis & {
  mongoose?: MongooseCache;
};

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  // Don't crash the Next.js dev server when env is missing — surface a helpful message instead.
  // In production we still want a hard failure, but during local development allow the app
  // to continue so pages that don't require the DB can render.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Please define the MONGODB_URI environment variable");
  } else {
    console.warn(
      "MONGODB_URI is not set. Database connections will be skipped in development."
    );
  }
}

const cached =
  globalWithMongoose.mongoose ??
  (globalWithMongoose.mongoose = { conn: null, promise: null });

export async function dbConnect() {
  if (cached.conn) return cached.conn;

  // If there's no URI (development) skip attempting to connect.
  if (!MONGODB_URI) return null;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI as string, {
        bufferCommands: false,
      })
      .then((mongoose) => mongoose)
      .catch((err) => {
        // Provide a clearer message for common DNS/connection issues and avoid
        // crashing the dev server. In production rethrow so deployment fails fast.
        console.error("Failed to connect to MongoDB:", err && err.message ? err.message : err);
        if (process.env.NODE_ENV === "production") {
          throw err;
        }
        // Reset promise so future attempts can retry.
        cached.promise = null;
        return null;
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
