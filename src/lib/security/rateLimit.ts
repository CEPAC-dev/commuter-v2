import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { SecurityRateLimit } from "@/models/SecurityRateLimit";

export async function enforceRateLimit(
  req: NextRequest,
  scope: string,
  options: { limit: number; windowMs: number },
): Promise<NextResponse | null> {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientAddress = forwarded || req.headers.get("x-real-ip") || "unknown";
  const windowStart =
    Math.floor(Date.now() / options.windowMs) * options.windowMs;
  const key = createHash("sha256")
    .update(`${scope}:${clientAddress}:${windowStart}`)
    .digest("hex");

  await connectDB();
  const record = await SecurityRateLimit.findOneAndUpdate(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(windowStart + options.windowMs) },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  if (record.count <= options.limit) return null;

  const retryAfter = Math.max(
    1,
    Math.ceil((record.expiresAt.getTime() - Date.now()) / 1000),
  );
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
