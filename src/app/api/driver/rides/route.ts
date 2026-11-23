import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { listDriverRideOffers } from "@/lib/services/rideService";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "driver") {
    return NextResponse.json(
      { error: "Driver access required" },
      { status: 403 },
    );
  }

  await connectDB();
  const offers = await listDriverRideOffers(session.userId);

  return NextResponse.json(
    { offers },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
