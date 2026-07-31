import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { cancelRide } from "@/lib/services/rideService";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  try {
    const deleted = await cancelRide(id, "Cancelled by admin");
    if (!deleted) {
      return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to cancel ride" },
      { status: 500 },
    );
  }
}
