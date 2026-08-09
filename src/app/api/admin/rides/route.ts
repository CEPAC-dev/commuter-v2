import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Ride } from "@/models/Ride";

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

  const [rides, totalCount] = await Promise.all([
    Ride.find()
      .sort({ date: -1, startTime: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("driverId", "name phone email")
      .populate(
        "availabilityId",
        "availabilityNumber date startLocation endLocation startTime endTime status",
      )
      .lean(),
    Ride.countDocuments(),
  ]);

  return NextResponse.json({
    rides: rides.map((ride) => ({
      ...ride,
      availability: ride.availabilityId ?? null,
    })),
    totalCount,
    page: safePage,
    limit: safeLimit,
  });
}
