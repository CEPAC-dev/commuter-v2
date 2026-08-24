import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Log } from "@/models/Log";
import { Trip } from "@/models/Trip";
import { getSession } from "@/lib/auth/session";
import { adminAuth } from "@/lib/middleware/adminAuth";

/**
 * GET /api/logs
 * Get logs with optional filters
 * Query params:
 *   - tripId: filter by tripId
 *   - userId: filter by userId
 *   - driverId: filter by driverId
 *   - action: filter by action
 *   - status: filter by status
 *   - limit: number of logs (default 50)
 *   - skip: pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await adminAuth();
    if (!auth.authorized) return auth.response;

    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const tripId = searchParams.get("tripId");
    const userId = searchParams.get("userId");
    const driverId = searchParams.get("driverId");
    const action = searchParams.get("action");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = parseInt(searchParams.get("skip") || "0");

    // Build filter object
    const filter: Record<string, unknown> = {};
    if (tripId) filter.tripId = tripId;
    if (userId) filter.userId = userId;
    if (driverId) filter.driverId = driverId;
    if (action) filter.action = action;
    if (status) filter.status = status;

    const logs = await Log.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Log.countDocuments(filter);

    return NextResponse.json(
      {
        success: true,
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
    console.error("[GET /api/logs]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch logs" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/logs
 * Create a new log entry
 * Body:
 *   - tripId: ObjectId
 *   - userId: ObjectId
 *   - driverId?: ObjectId
 *   - status: string (new status)
 *   - previousStatus?: string
 *   - action: string
 *   - description: string
 *   - metadata?: object
 *   - actorType: 'system' | 'user' | 'driver' | 'admin'
 *   - actorId?: ObjectId
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    await connectDB();

    const body = await request.json();
    const {
      tripId,
      userId,
      driverId,
      status,
      previousStatus,
      action,
      description,
      metadata,
    } = body;

    // Validate required fields
    if (!tripId || !userId || !status || !action || !description) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: tripId, userId, status, action, description",
        },
        { status: 400 },
      );
    }

    // Verify trip exists
    const trip = await Trip.findById(tripId)
      .select("userId driverId")
      .lean<{ userId: unknown; driverId?: unknown }>();
    if (!trip) {
      return NextResponse.json(
        { success: false, error: "Trip not found" },
        { status: 404 },
      );
    }

    const ownsTrip =
      String(trip.userId) === session.userId ||
      String(trip.driverId ?? "") === session.userId;
    if (session.role !== "admin" && !ownsTrip) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const actorType = session.role === "passenger" ? "user" : session.role;

    // Create log
    const log = await Log.create({
      tripId,
      userId: trip.userId,
      driverId: trip.driverId ?? driverId ?? null,
      status,
      previousStatus: previousStatus || null,
      action,
      description,
      metadata: metadata || {},
      actorType,
      actorId: session.userId,
    });

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/logs]", error);
    return NextResponse.json(
      { success: false, error: "Failed to create log" },
      { status: 500 },
    );
  }
}
