import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(_req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  await connectDB();

  const deleted = await Trip.findByIdAndDelete(id);
  if (!deleted) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
