import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { DAYS_OF_WEEK } from "@/lib/services/availability";

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
    const dayOfWeek = date
      ? DAYS_OF_WEEK[new Date(`${date}T00:00:00Z`).getUTCDay()]
      : null;
    const origin = record.origin ?? record.startLocation;
    const destination = record.destination ?? record.endLocation;

    if (
      !Number.isFinite(availabilityNumber) ||
      !driverId ||
      !date ||
      !dayOfWeek ||
      !startTime ||
      !endTime ||
      !isPlainObject(origin) ||
      !isPlainObject(destination)
    ) {
      continue;
    }

    const payload = {
      driverId,
      dayOfWeek,
      origin,
      destination,
      startNearestStation: record.startNearestStation ?? undefined,
      destinationNearestStation: record.destinationNearestStation ?? record.endNearestStation ?? undefined,
      startTime,
      endTime,
      active: record.active !== false,
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
