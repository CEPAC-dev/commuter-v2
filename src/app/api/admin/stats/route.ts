import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { User } from "@/models/User";
import { Trip } from "@/models/Trip";
import { Ride } from "@/models/Ride";
import { Availability } from "@/models/Availability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Live counts for sidebar quick-stat badges. Kept lightweight (no time-series here). */
export async function GET() {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  await connectDB();
  const [users, trips, rides, availability] = await Promise.all([
    User.countDocuments(),
    Trip.countDocuments(),
    Ride.countDocuments(),
    Availability.countDocuments(),
  ]);

  return NextResponse.json({ users, trips, rides, availability });
}
