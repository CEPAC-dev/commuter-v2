import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Log } from "@/models/Log";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/logs/driver/:driverId
 * Get all activity logs for a specific driver
 * Query params:
 *   - limit: number of logs (default 100)
 *   - skip: pagination offset (default 0)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> },
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

    const { driverId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "100");
    const skip = parseInt(searchParams.get("skip") || "0");

    // Drivers can only view their own logs (unless admin)
    // if (session.user?.id !== driverId && session.user?.role !== "admin") {
    //   return NextResponse.json(
    //     { success: false, error: "Forbidden" },
    //     { status: 403 }
    //   );
    // }

    const logs = await Log.find({ driverId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Log.countDocuments({ driverId });

    return NextResponse.json(
      {
        success: true,
        driverId,
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
    console.error("[GET /api/logs/driver/:driverId]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch driver activity logs" },
      { status: 500 },
    );
  }
}
