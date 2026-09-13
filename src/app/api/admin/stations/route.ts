import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Station } from "@/models/Station";
import { PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(req: NextRequest) {
  const auth = await adminAuth(
    PERMISSIONS.STATIONS_MANAGE,
    req.nextUrl.searchParams.get("region"),
  );
  if (!auth.authorized) return auth.response;

  await connectDB();

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const active = req.nextUrl.searchParams.get("active");
  const stationType = req.nextUrl.searchParams.get("stationType")?.trim();
  const direction = req.nextUrl.searchParams.get("direction")?.trim();
  const page = Math.max(Number(req.nextUrl.searchParams.get("page") ?? 1), 1);
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 25), 1), 100);
  const filter: Record<string, unknown> = { regionCode: auth.region.code };
  if (active === "true" || active === "false") filter.active = active === "true";
  if (stationType) filter.stationType = stationType;
  if (direction) filter.direction = direction;
  if (q) {
    const number = Number(q);
    filter.$or = [
      ...(Number.isFinite(number) ? [{ objectId: number }] : []),
      { name: { $regex: q, $options: "i" } },
      { landmark: { $regex: q, $options: "i" } },
      { zones: { $regex: q, $options: "i" } },
    ];
  }
  const [stations, total] = await Promise.all([
    Station.find(filter).sort({ objectId: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Station.countDocuments(filter),
  ]);

  return NextResponse.json({ stations, page, limit, total, totalPages: Math.ceil(total / limit) });
}
