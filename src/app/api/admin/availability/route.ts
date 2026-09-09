import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { Driver } from "@/models/Driver";
import { DAYS_OF_WEEK, validateAvailabilityWindow } from "@/lib/services/availability";
import { shiftsOverlap } from "@/lib/time/availabilityWindow";
import type { GeoPoint } from "@/types/geo";

function validPoint(value: unknown): value is GeoPoint {
  const point = value as GeoPoint;
  return Boolean(point && typeof point.address === "string" && point.address.trim() && typeof point.lat === "number" && typeof point.lng === "number");
}

export async function GET(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  await connectDB();
  const driverId = req.nextUrl.searchParams.get("driverId") ?? undefined;
  const dayOfWeek = req.nextUrl.searchParams.get("dayOfWeek") ?? undefined;
  const query: Record<string, unknown> = {};
  if (driverId) query.driverId = driverId;
  if (dayOfWeek && DAYS_OF_WEEK.includes(dayOfWeek as (typeof DAYS_OF_WEEK)[number])) query.dayOfWeek = dayOfWeek;
  const records = await Availability.find(query).sort({ driverId: 1, dayOfWeek: 1 }).populate("driverId", "name phone email").lean();
  return NextResponse.json({ records, totalCount: records.length });
}

export async function POST(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  await connectDB();
  try {
    const { id, driverId, dayOfWeek, origin, startTime, endTime, active } = await req.json();
    if (typeof driverId !== "string" || !driverId.trim()) return NextResponse.json({ error: "driverId is required." }, { status: 400 });
    if (!DAYS_OF_WEEK.includes(dayOfWeek)) return NextResponse.json({ error: "Invalid dayOfWeek." }, { status: 400 });
    if (!validPoint(origin)) return NextResponse.json({ error: "Origin is required." }, { status: 400 });
    const windowError = validateAvailabilityWindow(startTime, endTime);
    if (windowError) return NextResponse.json({ error: windowError }, { status: 400 });
    const driver = await Driver.exists({ userId: driverId });
    if (!driver) return NextResponse.json({ error: "Driver not found." }, { status: 404 });

    const sameDayShifts = await Availability.find({
      driverId,
      dayOfWeek,
      ...(id ? { _id: { $ne: id } } : {}),
    })
      .select("startTime endTime")
      .lean<{ startTime: string; endTime: string }[]>();
    if (shiftsOverlap(startTime, endTime, sameDayShifts)) {
      return NextResponse.json(
        { error: "This shift overlaps with another shift on the same day." },
        { status: 400 },
      );
    }

    const record = id
      ? await Availability.findOneAndUpdate(
          { _id: id, driverId },
          { $set: { dayOfWeek, origin, startTime, endTime, active: active ?? true } },
          { new: true },
        )
      : await Availability.create({ driverId, dayOfWeek, origin, startTime, endTime, active: active ?? true });
    if (!record) return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    return NextResponse.json({ ok: true, record });
  } catch {
    return NextResponse.json({ error: "Could not save availability." }, { status: 500 });
  }
}
