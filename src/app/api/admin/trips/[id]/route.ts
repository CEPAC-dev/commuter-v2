import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  await connectDB();

  const trip = await Trip.findById(id)
    .populate("requestId")
    .populate("userId", "name email phone role userNumber")
    .populate("driverId", "name email phone role")
    .populate("rideId")
    .lean();

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json({ trip });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  const expectedPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!expectedPassword) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not configured on the server." },
      { status: 500 },
    );
  }

  const providedPassword = req.headers.get("x-admin-password")?.trim();
  if (!providedPassword || providedPassword !== expectedPassword) {
    return NextResponse.json(
      { error: "Invalid admin password." },
      { status: 401 },
    );
  }

  const { id } = await params;
  await connectDB();

  const deleted = await Trip.findByIdAndDelete(id);
  if (!deleted) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
