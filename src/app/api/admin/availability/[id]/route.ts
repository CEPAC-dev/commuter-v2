import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { DAYS_OF_WEEK, validateAvailabilityWindow } from "@/lib/services/availability";
import { shiftsOverlap } from "@/lib/time/availabilityWindow";
import type { GeoPoint } from "@/types/geo";

function validPoint(value: unknown): value is GeoPoint {
  const point = value as GeoPoint;
  return Boolean(point && typeof point.address === "string" && point.address.trim() && typeof point.lat === "number" && typeof point.lng === "number");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  await connectDB();
  const record = await Availability.findById((await params).id).populate("driverId", "name phone email").lean();
  return record ? NextResponse.json({ data: record }) : NextResponse.json({ error: "Availability not found" }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  await connectDB();
  const id = (await params).id;
  const existing = await Availability.findById(id).lean();
  if (!existing) return NextResponse.json({ error: "Availability not found" }, { status: 404 });
  try {
    const body = await req.json();
    const dayOfWeek = body.dayOfWeek ?? existing.dayOfWeek;
    const origin = body.origin ?? existing.origin;
    const startTime = body.startTime ?? existing.startTime;
    const endTime = body.endTime ?? existing.endTime;
    if (!DAYS_OF_WEEK.includes(dayOfWeek)) return NextResponse.json({ error: "Invalid dayOfWeek." }, { status: 400 });
    if (!validPoint(origin)) return NextResponse.json({ error: "Origin is required." }, { status: 400 });
    const windowError = validateAvailabilityWindow(startTime, endTime);
    if (windowError) return NextResponse.json({ error: windowError }, { status: 400 });
    const sameDayShifts = await Availability.find({
      driverId: existing.driverId,
      dayOfWeek,
      _id: { $ne: id },
    })
      .select("startTime endTime")
      .lean<{ startTime: string; endTime: string }[]>();
    if (shiftsOverlap(startTime, endTime, sameDayShifts)) {
      return NextResponse.json(
        { error: "This shift overlaps with another shift on the same day." },
        { status: 400 },
      );
    }
    const updated = await Availability.findByIdAndUpdate(id, { $set: { dayOfWeek, origin, startTime, endTime, active: body.active ?? existing.active } }, { new: true }).populate("driverId", "name phone email").lean();
    return NextResponse.json({ ok: true, data: updated });
  } catch {
    return NextResponse.json({ error: "Could not update availability." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  await connectDB();
  const result = await Availability.deleteOne({ _id: (await params).id });
  return result.deletedCount ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Availability not found" }, { status: 404 });
}
