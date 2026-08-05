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

dns.setDefaultResultOrder?.("ipv4first");

async function resolveSrvFallback(uri: string): Promise<string> {
  const url = new URL(uri);
  const hostname = url.hostname;
  const srvName = `_mongodb._tcp.${hostname}`;
  const records = await dns.promises.resolveSrv(srvName);
  if (!records.length) {
    throw new Error(`No SRV records found for ${srvName}`);
  }

  const hosts = records.map(({ name, port }) => `${name}:${port}`).join(",");
  const fallbackUrl = new URL(`mongodb://${hosts}${url.pathname}`);
  fallbackUrl.username = url.username;
  fallbackUrl.password = url.password;

  const params = new URLSearchParams(url.searchParams);
  const txtRecords = await dns.promises.resolveTxt(hostname).catch(() => [] as string[][]);
  for (const entry of txtRecords.flat()) {
    const record = entry.toString();
    for (const pair of record.split("&")) {
      const [key, value] = pair.split("=");
      if (key && value && !params.has(key)) {
        params.set(key, value);
      }
    }
  }

  fallbackUrl.search = params.toString() ? `?${params.toString()}` : "";
  return fallbackUrl.toString();
}

async function connectWithFallback(uri: string) {
  const options = {
    bufferCommands: false,
    dbName: DB_NAME,
    serverSelectionTimeoutMS: 15_000,
    connectTimeoutMS: 15_000,
  };

  try {
    return await mongoose.connect(uri, options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (uri.startsWith("mongodb+srv://") && message.includes("querySrv")) {
      const fallbackUri = await resolveSrvFallback(uri);
      return await mongoose.connect(fallbackUri, options);
    }
    throw err;
  }
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = connectWithFallback(MONGODB_URI);
  }
  try {
    cache.conn = await cache.promise;
    return cache.conn;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
}
