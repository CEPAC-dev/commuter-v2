import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Log } from "@/models/Log";
import { Trip } from "@/models/Trip";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/logs/trip/:tripId
 * Get all logs for a specific trip
 * Query params:
 *   - limit: number of logs (default 100)
 *   - skip: pagination offset (default 0)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    await connectDB();

    const { tripId } = await params;
    if (session.role !== "admin") {
      const ownedTrip = await Trip.exists({
        _id: tripId,
        $or: [{ userId: session.userId }, { driverId: session.userId }],
      });
      if (!ownedTrip) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 },
        );
      }
    }
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "100");
    const skip = parseInt(searchParams.get("skip") || "0");

    const logs = await Log.find({ tripId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Log.countDocuments({ tripId });

    return NextResponse.json(
      {
        success: true,
        tripId,
        data: logs,
        pagination: {
          total,
          limit,
          skip,
          hasMore: skip + limit < total,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GET /api/logs/trip/:tripId]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch trip logs" },
      { status: 500 },
    );
  }
}
