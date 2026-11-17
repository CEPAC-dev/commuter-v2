import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  RegionAccessError,
  resolveActiveRegion,
} from "@/lib/regions/resolveActiveRegion";
import {
  BOOKING_CUTOFF_LOCAL_TIME,
  bookingWindow,
} from "@/lib/time/bookingDates";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const activeRegion = await resolveActiveRegion({ userId: session.userId });
    const generatedAt = new Date();
    const dates = bookingWindow(generatedAt, activeRegion.config.timezone);

    return NextResponse.json(
      {
        data: {
          region: activeRegion.code,
          timezone: activeRegion.config.timezone,
          cutoffLocalTime: BOOKING_CUTOFF_LOCAL_TIME,
          generatedAt: generatedAt.toISOString(),
          dates,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof RegionAccessError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }
    throw error;
  }
}
