import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Log } from "@/models/Log";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/logs/user/:userId
 * Get all activity logs for a specific user
 * Query params:
 *   - limit: number of logs (default 100)
 *   - skip: pagination offset (default 0)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
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

    const { userId } = await params;
    if (session.role !== "admin" && session.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "100");
    const skip = parseInt(searchParams.get("skip") || "0");

    const logs = await Log.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Log.countDocuments({ userId });

    return NextResponse.json(
      {
        success: true,
        userId,
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
    console.error("[GET /api/logs/user/:userId]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user activity logs" },
      { status: 500 },
    );
  }
}
