import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(_req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  await connectDB();

  const deleted = await Availability.findByIdAndDelete(id);
  if (!deleted) {
    return NextResponse.json({ error: "Availability not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
