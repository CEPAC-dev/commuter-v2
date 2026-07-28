import mongoose from "mongoose";
import dns from "dns";

// Force a reliable public DNS resolver — Node's default resolver can
// intermittently fail SRV lookups (ECONNREFUSED) for mongodb+srv:// URIs
// on some networks/adapters, especially on Windows.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.DB_NAME;
if (!MONGODB_URI) throw new Error("MONGODB_URI is not set");

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache;
}

const cache: MongooseCache = global._mongooseCache ?? {
  conn: null,
  promise: null,
};
global._mongooseCache = cache;

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 15_000,
      connectTimeoutMS: 15_000,
    });
  }
  try {
    cache.conn = await cache.promise;
    return cache.conn;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
}
