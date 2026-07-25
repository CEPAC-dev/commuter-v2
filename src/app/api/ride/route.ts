import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import {
  createRide,
  getRidesByDriver,
  getRideByPassengerIncluded,
} from "@/lib/services/rideService";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const ride = await createRide(body);
    return NextResponse.json({ data: ride }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create ride" },
      { status: 400 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get("driverId");
    const passengerId = searchParams.get("passengerId");
    const date = searchParams.get("date") ?? undefined;
    if (passengerId) {
      const rides = await getRideByPassengerIncluded(passengerId);
      return NextResponse.json({ data: rides });
    }

    if (!driverId) {
      return NextResponse.json({ error: "driverId is required" }, { status: 400 });
    }
    const rides = await getRidesByDriver(driverId, date);
    return NextResponse.json({ data: rides });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch rides" },
      { status: 500 },
    );
  }
}
