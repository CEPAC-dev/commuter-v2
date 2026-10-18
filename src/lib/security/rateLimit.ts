import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { SecurityRateLimit } from "@/models/SecurityRateLimit";

async function enforceLimitForKey(
  keyMaterial: string,
  options: { limit: number; windowMs: number },
  errorCode?: string,
): Promise<NextResponse | null> {
  const windowStart =
    Math.floor(Date.now() / options.windowMs) * options.windowMs;
  const key = createHash("sha256")
    .update(`${keyMaterial}:${windowStart}`)
    .digest("hex");

  await connectDB();
  const record = await SecurityRateLimit.findOneAndUpdate(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(windowStart + options.windowMs) },
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  );

  if (record.count <= options.limit) return null;

  const retryAfter = Math.max(
    1,
    Math.ceil((record.expiresAt.getTime() - Date.now()) / 1000),
  );
  return NextResponse.json(
    {
      ...(errorCode ? { errorCode } : {}),
      error: "Too many requests. Please try again later.",
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

function identityWindowKey(scope: string, identity: string, windowMs: number) {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  return createHash("sha256")
    .update(`v3:${scope}:${identity}:${windowStart}`)
    .digest("hex");
}

export async function enforceRateLimit(
  req: NextRequest,
  scope: string,
  options: { limit: number; windowMs: number },
): Promise<NextResponse | null> {
  const forwarded = req.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const clientAddress = forwarded || req.headers.get("x-real-ip")?.trim();
  // Never put every client behind a proxy into one shared lockout bucket.
  if (!clientAddress) return null;
  return enforceLimitForKey(
    `v2:${scope}:${clientAddress}`,
    options,
  );
}

export async function enforceRateLimitByIdentity(
  scope: string,
  identity: string,
  options: { limit: number; windowMs: number },
  errorCode: string,
): Promise<NextResponse | null> {
  if (!identity) throw new TypeError("Rate-limit identity is required.");
  return enforceLimitForKey(
    `v3:${scope}:${identity}`,
    options,
    errorCode,
  );
}

export async function incrementRateLimitCounterByIdentity(
  scope: string,
  identity: string,
  windowMs: number,
): Promise<number> {
  if (!identity) throw new TypeError("Rate-limit identity is required.");
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const key = identityWindowKey(scope, identity, windowMs);
  await connectDB();
  const record = await SecurityRateLimit.findOneAndUpdate(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(windowStart + windowMs) },
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  );
  return record.count;
}

export async function getRateLimitCounterByIdentity(
  scope: string,
  identity: string,
  windowMs: number,
): Promise<number> {
  if (!identity) throw new TypeError("Rate-limit identity is required.");
  const key = identityWindowKey(scope, identity, windowMs);
  await connectDB();
  const record = await SecurityRateLimit.findOne({
    key,
    expiresAt: { $gt: new Date() },
  })
    .select("count")
    .lean<{ count: number } | null>();
  return record?.count ?? 0;
}
