import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { Driver } from "@/models/Driver";
import { Station } from "@/models/Station";
import { findNearestStation } from "@/lib/geo/stations";
import type { GeoPoint as Point } from "@/types/geo";

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

async function getCanonicalStations() {
  const stationDocs = await Station.find({ active: true }).lean();
  return stationDocs.map((station) => ({
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
}

const ALLOWED_STATUSES = ["open", "matched", "full", "closed", "cancelled"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  await connectDB();

  const record = await Availability.findById(id)
    .populate("driverId", "name phone email")
    .lean();

  if (!record) {
    return NextResponse.json(
      { error: "Availability not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: record });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  await connectDB();

  try {
    const body = await req.json();
    const existing = await Availability.findById(id).lean<{
      driverId: unknown;
      date: string;
      startLocation: Point;
      endLocation: Point;
      startTime: string;
      endTime: string;
      status: string;
    } | null>();

    if (!existing) {
      return NextResponse.json(
        { error: "Availability not found" },
        { status: 404 },
      );
    }

    const nextDriverId =
      typeof body.driverId === "string" && body.driverId.trim()
        ? body.driverId.trim()
        : String(existing.driverId);
    const nextDate = typeof body.date === "string" ? body.date : existing.date;
    const nextStartLocation = body.startLocation ?? existing.startLocation;
    const nextEndLocation = body.endLocation ?? existing.endLocation;
    const nextStartTime =
      typeof body.startTime === "string" ? body.startTime : existing.startTime;
    const nextEndTime =
      typeof body.endTime === "string" ? body.endTime : existing.endTime;
    const nextStatus =
      typeof body.status === "string" ? body.status : existing.status;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
      return NextResponse.json(
        { error: "Invalid date format." },
        { status: 400 },
      );
    }

    if (!isValidPoint(nextStartLocation) || !isValidPoint(nextEndLocation)) {
      return NextResponse.json(
        { error: "Start and end locations are required." },
        { status: 400 },
      );
    }

    if (!isValidTime(nextStartTime) || !isValidTime(nextEndTime)) {
      return NextResponse.json(
        { error: "Start and end time are required." },
        { status: 400 },
      );
    }

    if (nextStartTime >= nextEndTime) {
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 },
      );
    }

    if (!ALLOWED_STATUSES.includes(nextStatus)) {
      return NextResponse.json(
        { error: "Invalid availability status." },
        { status: 400 },
      );
    }

    const driver = await Driver.findOne({ userId: nextDriverId })
      .select("userId")
      .lean();
    if (!driver) {
      return NextResponse.json({ error: "Driver not found." }, { status: 404 });
    }

    const canonicalStations = await getCanonicalStations();
    const startNearestStation = findNearestStation(
      nextStartLocation.lat,
      nextStartLocation.lng,
      canonicalStations,
    );
    const endNearestStation = findNearestStation(
      nextEndLocation.lat,
      nextEndLocation.lng,
      canonicalStations,
    );

    const updateDoc = {
      driverId: nextDriverId,
      date: nextDate,
      startLocation: {
        address: nextStartLocation.address,
        lat: nextStartLocation.lat,
        lng: nextStartLocation.lng,
      },
      endLocation: {
        address: nextEndLocation.address,
        lat: nextEndLocation.lat,
        lng: nextEndLocation.lng,
      },
      startTime: nextStartTime,
      endTime: nextEndTime,
      status: nextStatus,
      startNearestStation: startNearestStation
        ? {
            id: startNearestStation.id,
            name: startNearestStation.name,
            direction: startNearestStation.direction,
            stationType: startNearestStation.stationType,
            lat: startNearestStation.lat,
            lng: startNearestStation.lng,
          }
        : null,
      endNearestStation: endNearestStation
        ? {
            id: endNearestStation.id,
            name: endNearestStation.name,
            direction: endNearestStation.direction,
            stationType: endNearestStation.stationType,
            lat: endNearestStation.lat,
            lng: endNearestStation.lng,
          }
        : null,
    };

    const updated = await Availability.findByIdAndUpdate(id, updateDoc, {
      returnDocument: "after",
    })
      .populate("driverId", "name phone email")
      .lean();

    return NextResponse.json({ ok: true, data: updated });
  } catch {
    return NextResponse.json(
      { error: "Could not update availability." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(_req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  await connectDB();

  const deleted = await Availability.findByIdAndDelete(id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Availability not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
