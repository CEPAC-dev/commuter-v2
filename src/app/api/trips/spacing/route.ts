import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { HOLDING_TRIP_STATUSES } from "@/lib/validation/tripSpacing";
import { Trip } from "@/models/Trip";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new URL(req.url).searchParams.get("date");
  const parsedDate = date ? new Date(`${date}T00:00:00.000Z`) : null;
  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !parsedDate ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  await connectDB();
  const trips = await Trip.find({
    userId: session.userId,
    date,
    status: { $in: HOLDING_TRIP_STATUSES },
  })
    .select("date arrivalTime status requestId")
    .lean();

  return NextResponse.json({
    data: trips.map((trip) => ({
      date: trip.date,
      arrivalTime: trip.arrivalTime,
      status: trip.status,
      requestId: trip.requestId ? String(trip.requestId) : null,
    })),
  });
}
