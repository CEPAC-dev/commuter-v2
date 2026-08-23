import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { Trip } from "@/models/Trip";

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  await connectDB();

  try {
    const body = await req.json();
    const fromDate = body?.fromDate;
    const toDate = body?.toDate;

    if (!isValidDate(fromDate) || !isValidDate(toDate)) {
      return NextResponse.json(
        { error: "fromDate and toDate must be valid YYYY-MM-DD strings." },
        { status: 400 },
      );
    }

    if (fromDate === toDate) {
      return NextResponse.json(
        {
          ok: true,
          message:
            "Source and target dates are the same; no changes were applied.",
          availabilityCount: 0,
          tripCount: 0,
        },
        { status: 200 },
      );
    }

    const [availabilityResult, tripResult] = await Promise.all([
      Availability.updateMany({ date: fromDate }, { $set: { date: toDate } }),
      Trip.updateMany({ date: fromDate }, { $set: { date: toDate } }),
    ]);

    return NextResponse.json({
      ok: true,
      availabilityCount: availabilityResult.modifiedCount ?? 0,
      tripCount: tripResult.modifiedCount ?? 0,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to shift dates.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
