import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import {
  DAYS_OF_WEEK,
  validateAvailabilityWindow,
} from "@/lib/services/availability";
import { shiftsOverlap } from "@/lib/time/availabilityWindow";
import { isRegionCode, regionFromCoordinates } from "@/lib/config/regions";
import type { GeoPoint } from "@/types/geo";
import { loadServiceZones } from "@/lib/geo/zones.server";
import { isPointInAnyZone } from "@/lib/geo/zones";

function validPoint(value: unknown): value is GeoPoint {
  const point = value as GeoPoint;
  return Boolean(
    point &&
    typeof point.address === "string" &&
    point.address.trim() &&
    typeof point.lat === "number" &&
    typeof point.lng === "number",
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(
    undefined,
    req.nextUrl.searchParams.get("region"),
    req.nextUrl.searchParams.get("cityCode"),
  );
  if (!auth.authorized) return auth.response;
  await connectDB();
  const record = await Availability.findOne({
    _id: (await params).id,
    regionCode: auth.region.code,
    cityCode: auth.region.cityCode,
  })
    .populate("driverId", "name phone email")
    .lean();
  return record
    ? NextResponse.json(
        { data: record },
        { headers: { "Cache-Control": "private, no-store" } },
      )
    : NextResponse.json({ error: "Availability not found" }, { status: 404 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(
    undefined,
    req.nextUrl.searchParams.get("region"),
    req.nextUrl.searchParams.get("cityCode"),
  );
  if (!auth.authorized) return auth.response;
  await connectDB();
  const id = (await params).id;
  const existing = await Availability.findOne({
    _id: id,
    regionCode: auth.region.code,
    cityCode: auth.region.cityCode,
  }).lean();
  if (!existing)
    return NextResponse.json(
      { error: "Availability not found" },
      { status: 404 },
    );
  try {
    const body = await req.json();
    const dayOfWeek = body.dayOfWeek ?? existing.dayOfWeek;
    const origin = body.origin ?? existing.origin;
    const startTime = body.startTime ?? existing.startTime;
    const endTime = body.endTime ?? existing.endTime;
    if (!DAYS_OF_WEEK.includes(dayOfWeek))
      return NextResponse.json(
        { error: "Invalid dayOfWeek." },
        { status: 400 },
      );
    if (!validPoint(origin))
      return NextResponse.json(
        { error: "Origin is required." },
        { status: 400 },
      );
    const regionCode =
      regionFromCoordinates(origin.lat, origin.lng) ??
      (isRegionCode(existing.regionCode) ? existing.regionCode : null);
    if (!regionCode || regionCode !== auth.region.code) {
      return NextResponse.json(
        { error: "Availability must belong to the selected Region." },
        { status: 400 },
      );
    }
    const zones = await loadServiceZones(regionCode, auth.region.cityCode);
    if (!zones.length || !isPointInAnyZone([origin.lng, origin.lat], zones)) {
      return NextResponse.json(
        { error: "Availability origin must be inside the selected City/State service area." },
        { status: 400 },
      );
    }
    const windowError = validateAvailabilityWindow(startTime, endTime);
    if (windowError)
      return NextResponse.json({ error: windowError }, { status: 400 });
    const sameDayShifts = await Availability.find({
      driverId: existing.driverId,
      regionCode,
      cityCode: auth.region.cityCode,
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
    const updated = await Availability.findByIdAndUpdate(
      id,
      {
        $set: {
          dayOfWeek,
          origin,
          regionCode,
          cityCode: auth.region.cityCode,
          startTime,
          endTime,
          active: body.active ?? existing.active,
        },
      },
      { returnDocument: "after" },
    )
      .populate("driverId", "name phone email")
      .lean();
    return NextResponse.json(
      { ok: true, data: updated },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not update availability." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(
    undefined,
    req.nextUrl.searchParams.get("region"),
    req.nextUrl.searchParams.get("cityCode"),
  );
  if (!auth.authorized) return auth.response;
  await connectDB();
  const result = await Availability.deleteOne({
    _id: (await params).id,
    regionCode: auth.region.code,
    cityCode: auth.region.cityCode,
  });
  return result.deletedCount
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Availability not found" }, { status: 404 });
}
