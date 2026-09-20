import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { Driver } from "@/models/Driver";
import { Station } from "@/models/Station";
import {
  DAYS_OF_WEEK,
  validateAvailabilityWindow,
} from "@/lib/services/availability";
import { shiftsOverlap } from "@/lib/time/availabilityWindow";
import { findNearestStation } from "@/lib/geo/stations";
import { regionFromCoordinates } from "@/lib/config/regions";
import type { GeoPoint } from "@/types/geo";

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

export async function GET(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  await connectDB();
  const driverId = req.nextUrl.searchParams.get("driverId") ?? undefined;
  const dayOfWeek = req.nextUrl.searchParams.get("dayOfWeek") ?? undefined;
  const query: Record<string, unknown> = {};
  if (driverId) query.driverId = driverId;
  if (
    dayOfWeek &&
    DAYS_OF_WEEK.includes(dayOfWeek as (typeof DAYS_OF_WEEK)[number])
  )
    query.dayOfWeek = dayOfWeek;
  const records = await Availability.find(query)
    .sort({ driverId: 1, dayOfWeek: 1 })
    .populate("driverId", "name phone email")
    .lean();
  return NextResponse.json({ records, totalCount: records.length });
}

export async function POST(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  await connectDB();
  try {
    const {
      id,
      driverId,
      dayOfWeek,
      origin,
      destination,
      startTime,
      endTime,
      active,
    } = await req.json();
    if (typeof driverId !== "string" || !driverId.trim())
      return NextResponse.json(
        { error: "driverId is required." },
        { status: 400 },
      );
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
    if (!validPoint(destination))
      return NextResponse.json(
        { error: "Destination is required." },
        { status: 400 },
      );
    const regionCode = regionFromCoordinates(origin.lat, origin.lng);
    if (
      !regionCode ||
      regionFromCoordinates(destination.lat, destination.lng) !== regionCode
    ) {
      return NextResponse.json(
        {
          error:
            "Origin and destination must be inside the same supported region.",
        },
        { status: 400 },
      );
    }
    const windowError = validateAvailabilityWindow(startTime, endTime);
    if (windowError)
      return NextResponse.json({ error: windowError }, { status: 400 });
    const driver = await Driver.exists({ userId: driverId });
    if (!driver)
      return NextResponse.json({ error: "Driver not found." }, { status: 404 });

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

    const stationDocs = await Station.find({ active: true, regionCode })
      .select("objectId name lat lng stationType")
      .lean();
    const stations = stationDocs.map((station) => ({
      id: station.objectId,
      name: station.name,
      lat: station.lat,
      lng: station.lng,
      stationType: station.stationType,
      popupInfo: "",
    }));
    const startNearestStation = findNearestStation(
      origin.lat,
      origin.lng,
      stations,
    );
    const destinationNearestStation = findNearestStation(
      destination.lat,
      destination.lng,
      stations,
    );
    if (!startNearestStation || !destinationNearestStation) {
      return NextResponse.json(
        { error: "No nearby stations were found for this region." },
        { status: 400 },
      );
    }
    const stationData = (station: typeof startNearestStation) => ({
      id: station.id,
      lat: station.lat,
      lng: station.lng,
      name: station.name,
    });
    const fields = {
      driverId,
      regionCode,
      dayOfWeek,
      origin,
      destination,
      startNearestStation: stationData(startNearestStation),
      destinationNearestStation: stationData(destinationNearestStation),
      startTime,
      endTime,
      active: active ?? true,
    };

    const record = id
      ? await Availability.findOneAndUpdate(
          { _id: id, driverId },
          { $set: fields },
          { new: true },
        )
      : await Availability.create(fields);
    if (!record)
      return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    return NextResponse.json({ ok: true, record });
  } catch {
    return NextResponse.json(
      { error: "Could not save availability." },
      { status: 500 },
    );
  }
}
