import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { nextSequence } from "@/models/Counter";
import { Driver } from "@/models/Driver";
import { Station } from "@/models/Station";
import { getSession } from "@/lib/auth/session";
import { findNearestStation } from "@/lib/geo/stations";
import type { GeoPoint as Point } from "@/types/geo";
import { listDriverAvailability } from "@/lib/services/availability";

function isValidPoint(p: unknown): p is Point {
  const point = p as Point;
  return (
    !!point &&
    typeof point.address === "string" &&
    point.address.trim().length > 0 &&
    typeof point.lat === "number" &&
    typeof point.lng === "number"
  );
}

function isValidTime(t: unknown): t is string {
  return typeof t === "string" && /^\d{2}:\d{2}$/.test(t);
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "driver")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const records = await listDriverAvailability(session.userId);
  return NextResponse.json({ data: records });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "driver")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const driver = await Driver.findOne({ userId: session.userId })
    .select("verificationStatus carCapacity")
    .lean<{ verificationStatus?: string; carCapacity?: number }>();
  if (driver?.verificationStatus !== "verified")
    return NextResponse.json(
      { error: "Your profile must be verified before adding availability." },
      { status: 403 },
    );
  const seats = driver?.carCapacity ?? 4;

  try {
    const { dates, startLocation, endLocation, startTime, endTime } =
      await req.json();

    if (!Array.isArray(dates) || dates.length === 0)
      return NextResponse.json(
        { error: "Select at least one date." },
        { status: 400 },
      );
    if (
      !dates.every(
        (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
      )
    )
      return NextResponse.json(
        { error: "Invalid date format." },
        { status: 400 },
      );
    if (!isValidPoint(startLocation) || !isValidPoint(endLocation))
      return NextResponse.json(
        { error: "Start and end locations are required." },
        { status: 400 },
      );
    if (!isValidTime(startTime) || !isValidTime(endTime))
      return NextResponse.json(
        { error: "Start and end time are required." },
        { status: 400 },
      );
    if (startTime >= endTime)
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 },
      );

    const stationDocs = await Station.find({ active: true }).lean();
    const canonicalStations = stationDocs.map((station) => ({
      id: station.objectId,
      name: station.name || station.direction || "",
      direction: station.direction,
      stationType: station.stationType,
      lat: station.lat,
      lng: station.lng,
      popupInfo: [station.direction, station.landmark, station.stationType]
        .filter(Boolean)
        .join("\n"),
    }));
    const startNearestStation = findNearestStation(
      startLocation.lat,
      startLocation.lng,
      canonicalStations,
    );
    const endNearestStation = findNearestStation(
      endLocation.lat,
      endLocation.lng,
      canonicalStations,
    );

    const docs = await Promise.all(
      dates.map(async (date: string) => ({
        availabilityNumber: await nextSequence("availabilityNumber"),
        driverId: session.userId,
        date,
        startLocation: {
          address: startLocation.address,
          lat: startLocation.lat,
          lng: startLocation.lng,
        },
        endLocation: {
          address: endLocation.address,
          lat: endLocation.lat,
          lng: endLocation.lng,
        },
        // seatsRemaining: seats,
        ...(startNearestStation && {
          startNearestStation: {
            id: startNearestStation.id,
            name: startNearestStation.name,
            direction: startNearestStation.direction,
            stationType: startNearestStation.stationType,
            lat: startNearestStation.lat,
            lng: startNearestStation.lng,
          },
        }),
        ...(endNearestStation && {
          endNearestStation: {
            id: endNearestStation.id,
            name: endNearestStation.name,
            direction: endNearestStation.direction,
            stationType: endNearestStation.stationType,
            lat: endNearestStation.lat,
            lng: endNearestStation.lng,
          },
        }),
        startTime,
        endTime,
      })),
    );

    const created = await Availability.insertMany(docs);
    return NextResponse.json({ ok: true, records: created }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create availability." },
      { status: 500 },
    );
  }
}
