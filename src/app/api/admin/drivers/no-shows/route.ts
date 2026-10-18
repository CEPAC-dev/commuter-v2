import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(
  body: unknown,
  init?: { status?: number },
): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const authorization = await adminAuth();
  if (!authorization.authorized) {
    authorization.response.headers.set("Cache-Control", "no-store");
    return authorization.response;
  }

  const rawDays = request.nextUrl.searchParams.get("days");
  const days = rawDays === null ? 30 : Number(rawDays);
  if (
    (rawDays !== null && !/^[1-9]\d*$/.test(rawDays)) ||
    !Number.isSafeInteger(days) ||
    days < 1
  ) {
    return noStoreJson(
      { error: "days must be a positive integer." },
      { status: 400 },
    );
  }
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(since.getTime())) {
    return noStoreJson(
      { error: "days is outside the supported range." },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const drivers = await Trip.aggregate([
      {
        $match: {
          status: "no_show",
          noShowAt: { $gte: since },
          driverId: { $ne: null },
          rideId: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$driverId",
          noShowTripCount: { $sum: 1 },
          rideIds: { $addToSet: "$rideId" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "driver",
        },
      },
      { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          driverId: { $toString: "$_id" },
          name: "$driver.name",
          noShowTripCount: 1,
          totalRideCount: { $size: "$rideIds" },
        },
      },
      { $sort: { noShowTripCount: -1, driverId: 1 } },
    ]).exec();

    return noStoreJson({ days, drivers });
  } catch (error) {
    console.error("[GET /api/admin/drivers/no-shows]", error);
    return noStoreJson(
      { error: "Failed to load driver no-show counts." },
      { status: 500 },
    );
  }
}
