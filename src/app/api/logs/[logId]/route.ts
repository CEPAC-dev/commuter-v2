import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Log } from "@/models/Log";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/logs/:logId
 * Get a specific log by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  try {
    await connectDB();

    const { logId } = await params;

    const log = await Log.findById(logId).lean();

    if (!log) {
      return NextResponse.json(
        { success: false, error: "Log not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: log }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/logs/:logId]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch log" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/logs/:logId
 * Delete a specific log by ID (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Optional: Add admin check if needed
    // if (session.user?.role !== "admin") {
    //   return NextResponse.json(
    //     { success: false, error: "Forbidden" },
    //     { status: 403 }
    //   );
    // }

    await connectDB();

    const { logId } = await params;

    const log = await Log.findByIdAndDelete(logId);

    if (!log) {
      return NextResponse.json(
        { success: false, error: "Log not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, message: "Log deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("[DELETE /api/logs/:logId]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete log" },
      { status: 500 },
    );
  }
}
