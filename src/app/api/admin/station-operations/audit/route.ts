import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { connectDB } from "@/lib/db/mongoose";
import { StationAuditLog } from "@/models/StationAuditLog";

export async function GET(req: NextRequest) {
  const auth = await adminAuth(PERMISSIONS.STATIONS_MANAGE, req.nextUrl.searchParams.get("region"));
  if (!auth.authorized) return auth.response;
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 25), 1), 100);
  await connectDB();
  const logs = await StationAuditLog.find({ regionCode: auth.region.code }).sort({ createdAt: -1 }).limit(limit).populate("actorId", "name email").lean();
  return NextResponse.json({ logs });
}
