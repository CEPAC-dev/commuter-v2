import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";

export async function GET(req: NextRequest) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  await connectDB();

  const { searchParams } = new URL(req.url);
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
  const skip = (safePage - 1) * safeLimit;

  const [trips, totalCount] = await Promise.all([
    Trip.find()
      .sort({ date: -1, pickupTime: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("driverId", "name phone")
      .lean(),
    Trip.countDocuments(),
  ]);

  return NextResponse.json({
    trips,
    totalCount,
    page: safePage,
    limit: safeLimit,
  });
}
