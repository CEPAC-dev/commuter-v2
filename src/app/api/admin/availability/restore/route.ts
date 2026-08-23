import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "A JSON file is required." },
      { status: 400 },
    );
  }

  if (!file.name.toLowerCase().endsWith(".json")) {
    return NextResponse.json(
      { error: "Only JSON files are allowed." },
      { status: 400 },
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return NextResponse.json({ error: "Invalid JSON file." }, { status: 400 });
  }

  if (!Array.isArray(raw)) {
    return NextResponse.json(
      { error: "The JSON payload must be an array of availability records." },
      { status: 400 },
    );
  }

  await connectDB();

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of raw) {
    if (!isPlainObject(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const availabilityNumber = Number(record.availabilityNumber);
    const driverId =
      typeof record.driverId === "string" ? record.driverId : null;
    const date = typeof record.date === "string" ? record.date : null;
    const startTime =
      typeof record.startTime === "string" ? record.startTime : null;
    const endTime = typeof record.endTime === "string" ? record.endTime : null;

    if (
      !Number.isFinite(availabilityNumber) ||
      !driverId ||
      !date ||
      !startTime ||
      !endTime
    ) {
      continue;
    }

    const payload = {
      availabilityNumber,
      driverId,
      date,
      startLocation: record.startLocation ?? {
        address: "Unknown",
        lat: 0,
        lng: 0,
      },
      endLocation: record.endLocation ?? { address: "Unknown", lat: 0, lng: 0 },
      startNearestStation: record.startNearestStation ?? undefined,
      endNearestStation: record.endNearestStation ?? undefined,
      startTime,
      endTime,
      status: typeof record.status === "string" ? record.status : "open",
      matched: Boolean(record.matched),
      rideId: typeof record.rideId === "string" ? record.rideId : null,
    };

    const existing = await Availability.findOne({ availabilityNumber }).lean();

    if (existing) {
      await Availability.updateOne(
        { availabilityNumber },
        { $set: payload },
        { upsert: true },
      );
      updatedCount += 1;
    } else {
      await Availability.create(payload);
      createdCount += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    createdCount,
    updatedCount,
    totalProcessed: raw.length,
  });
}
