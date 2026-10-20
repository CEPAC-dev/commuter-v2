import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { TripReport } from "@/models/TripReport";
import { isValidObjectId } from "mongoose";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "passenger")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!isValidObjectId(id))
    return NextResponse.json({ error: "Invalid trip ID" }, { status: 400 });

  const body = await req.json();
  const { category, description } = body;

  if (
    !category ||
    ![
      "vehicle_condition",
      "driver_behavior",
      "route_issue",
      "safety_concern",
      "pricing_issue",
      "cleanliness",
      "other",
    ].includes(category)
  ) {
    return NextResponse.json(
      { error: "Invalid category" },
      { status: 400 },
    );
  }

  if (!description || typeof description !== "string" || description.trim().length < 5) {
    return NextResponse.json(
      { error: "Description is required (min 5 characters)" },
      { status: 400 },
    );
  }

  if (description.length > 1000) {
    return NextResponse.json(
      { error: "Description too long (max 1000 characters)" },
      { status: 400 },
    );
  }

  await connectDB();

  const trip = await Trip.findOne({
    _id: id,
    userId: session.userId,
    status: "completed",
  }).lean();

  if (!trip) {
    return NextResponse.json(
      { error: "Trip not found or not completed" },
      { status: 404 },
    );
  }

  // Check if already reported by this user for this trip
  const existing = await TripReport.findOne({
    tripId: id,
    userId: session.userId,
  });

  if (existing) {
    return NextResponse.json(
      { error: "Report already submitted for this trip" },
      { status: 400 },
    );
  }

  const report = await TripReport.create({
    tripId: id,
    userId: session.userId,
    driverId: trip.driverId || null,
    category,
    description: description.trim(),
    status: "open",
  });

  return NextResponse.json({
    success: true,
    reportId: report._id,
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "passenger")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!isValidObjectId(id))
    return NextResponse.json({ error: "Invalid trip ID" }, { status: 400 });

  await connectDB();

  const report = await TripReport.findOne({
    tripId: id,
    userId: session.userId,
  }).lean();

  return NextResponse.json({ hasReport: Boolean(report), report });
}
