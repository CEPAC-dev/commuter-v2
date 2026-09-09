import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { Driver } from "@/models/Driver";
import { getSession } from "@/lib/auth/session";
import {
  DAYS_OF_WEEK,
  listDriverAvailability,
  validateAvailabilityWindow,
} from "@/lib/services/availability";
import {
  isValidAvailabilityId,
  normalizeAvailabilityOrigin,
  shiftsOverlap,
} from "@/lib/time/availabilityWindow";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "driver")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const records = await listDriverAvailability(session.userId);
  return NextResponse.json({ data: records });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "driver")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const driver = await Driver.findOne({ userId: session.userId })
      .select("verificationStatus")
      .lean<{ verificationStatus?: string }>();
    if (driver?.verificationStatus !== "verified")
      return NextResponse.json(
        { error: "Your profile must be verified before adding availability." },
        { status: 403 },
      );

    const payload = await req.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Invalid availability payload." }, { status: 400 });
    }

    const { id, dayOfWeek, days, origin, startTime, endTime, active } = payload as {
      id?: unknown;
      dayOfWeek?: unknown;
      days?: unknown;
      origin?: unknown;
      startTime?: unknown;
      endTime?: unknown;
      active?: unknown;
    };

    const targetDays: string[] = Array.isArray(days)
      ? (days as string[]).filter((d) => DAYS_OF_WEEK.includes(d as (typeof DAYS_OF_WEEK)[number]))
      : typeof dayOfWeek === "string" && DAYS_OF_WEEK.includes(dayOfWeek as (typeof DAYS_OF_WEEK)[number])
        ? [dayOfWeek]
        : [];

    if (targetDays.length === 0) {
      return NextResponse.json({ error: "At least one valid day must be selected." }, { status: 400 });
    }

    const normalizedOrigin = normalizeAvailabilityOrigin(origin);
    if (!normalizedOrigin)
      return NextResponse.json({ error: "Origin is required." }, { status: 400 });

    if (id != null && id !== "" && !isValidAvailabilityId(id))
      return NextResponse.json({ error: "Invalid shift id." }, { status: 400 });

    const windowError = validateAvailabilityWindow(startTime, endTime);
    if (windowError)
      return NextResponse.json({ error: windowError }, { status: 400 });

    const DAY_NAMES: Record<string, string> = {
      sun: "Sunday",
      mon: "Monday",
      tue: "Tuesday",
      wed: "Wednesday",
      thu: "Thursday",
      fri: "Friday",
      sat: "Saturday",
    };

    // Validate overlap for all target days
    for (const day of targetDays) {
      const sameDayShifts = await Availability.find({
        driverId: session.userId,
        dayOfWeek: day,
        ...(id && isValidAvailabilityId(id) ? { _id: { $ne: id } } : {}),
      })
        .select("startTime endTime")
        .lean<{ startTime: string; endTime: string }[]>();

      if (shiftsOverlap(startTime as string, endTime as string, sameDayShifts)) {
        return NextResponse.json(
          {
            error: `Shift overlaps with another shift on ${DAY_NAMES[day] ?? day} (${startTime}–${endTime}).`,
          },
          { status: 400 },
        );
      }
    }

    if (id && isValidAvailabilityId(id)) {
      const record = await Availability.findOneAndUpdate(
        { _id: id, driverId: session.userId },
        {
          $set: {
            dayOfWeek: targetDays[0],
            origin: normalizedOrigin,
            startTime,
            endTime,
            active: active ?? true,
          },
        },
        { new: true },
      );
      if (!record)
        return NextResponse.json({ error: "Shift not found." }, { status: 404 });
      return NextResponse.json({ ok: true, record, records: [record] }, { status: 200 });
    }

    // Create records for all selected target days
    const createdRecords = await Promise.all(
      targetDays.map((day) =>
        Availability.create({
          driverId: session.userId,
          dayOfWeek: day,
          origin: normalizedOrigin,
          startTime,
          endTime,
          active: active ?? true,
        }),
      ),
    );

    return NextResponse.json(
      { ok: true, record: createdRecords[0], records: createdRecords },
      { status: 200 },
    );
  } catch (error) {
    console.error("Driver availability save failed:", error);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Could not save availability."
            : error instanceof Error
              ? error.message
              : "Could not save availability.",
      },
      { status: 500 },
    );
  }
}


