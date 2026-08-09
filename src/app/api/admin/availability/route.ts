import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { nextSequence } from "@/models/Counter";
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

async function buildAvailabilityPayload(input: {
  driverId: string;
  date: string;
  startLocation: Point;
  endLocation: Point;
  startTime: string;
  endTime: string;
  status?: string;
}) {
  const canonicalStations = await getCanonicalStations();
  const startNearestStation = findNearestStation(
    input.startLocation.lat,
    input.startLocation.lng,
    canonicalStations,
  );
  const endNearestStation = findNearestStation(
    input.endLocation.lat,
    input.endLocation.lng,
    canonicalStations,
  );

  return {
    availabilityNumber: await nextSequence("availabilityNumber"),
    driverId: input.driverId,
    date: input.date,
    startLocation: {
      address: input.startLocation.address,
      lat: input.startLocation.lat,
      lng: input.startLocation.lng,
    },
    endLocation: {
      address: input.endLocation.address,
      lat: input.endLocation.lat,
      lng: input.endLocation.lng,
    },
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
    startTime: input.startTime,
    endTime: input.endTime,
    ...(input.status ? { status: input.status } : {}),
  };
}

const ALLOWED_STATUSES = ["open", "matched", "full", "closed", "cancelled"];

export async function GET(req: NextRequest) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  await connectDB();

  const { searchParams } = new URL(req.url);
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const driverId = searchParams.get("driverId")?.trim();
  const date = searchParams.get("date")?.trim();
  const status = searchParams.get("status")?.trim();
  const availabilityNumber = Number(searchParams.get("availabilityNumber") ?? "");
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
  const skip = (safePage - 1) * safeLimit;
  const query: Record<string, unknown> = {};

  if (driverId) query.driverId = driverId;
  if (date) query.date = date;
  if (status && ALLOWED_STATUSES.includes(status)) query.status = status;
  if (Number.isFinite(availabilityNumber)) query.availabilityNumber = availabilityNumber;

  const [records, totalCount] = await Promise.all([
    Availability.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("driverId", "name phone email")
      .lean(),
    Availability.countDocuments(query),
  ]);

  return NextResponse.json({
    records,
    totalCount,
    page: safePage,
    limit: safeLimit,
  });
}

export async function POST(req: NextRequest) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  await connectDB();

  try {
    const { driverId, date, dates, startLocation, endLocation, startTime, endTime, status } =
      await req.json();

    if (typeof driverId !== "string" || !driverId.trim()) {
      return NextResponse.json({ error: "driverId is required." }, { status: 400 });
    }

    const normalizedDates = Array.isArray(dates)
      ? dates
      : typeof date === "string"
        ? [date]
        : [];

    if (!normalizedDates.length) {
      return NextResponse.json(
        { error: "Provide date or dates." },
        { status: 400 },
      );
    }

    if (
      !normalizedDates.every(
        (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
      )
    ) {
      return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
    }

    if (!isValidPoint(startLocation) || !isValidPoint(endLocation)) {
      return NextResponse.json(
        { error: "Start and end locations are required." },
        { status: 400 },
      );
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return NextResponse.json(
        { error: "Start and end time are required." },
        { status: 400 },
      );
    }

    if (startTime >= endTime) {
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 },
      );
    }

    if (status != null && !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid availability status." }, { status: 400 });
    }

    const driver = await Driver.findOne({ userId: driverId }).select("userId").lean();
    if (!driver) {
      return NextResponse.json({ error: "Driver not found." }, { status: 404 });
    }

    const docs = await Promise.all(
      normalizedDates.map((value: string) =>
        buildAvailabilityPayload({
          driverId: driverId.trim(),
          date: value,
          startLocation,
          endLocation,
          startTime,
          endTime,
          status,
        }),
      ),
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
