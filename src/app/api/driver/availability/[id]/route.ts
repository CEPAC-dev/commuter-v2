import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { getSession } from "@/lib/auth/session";
import { resolveActiveRegion } from "@/lib/regions/resolveActiveRegion";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "driver")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const region = await resolveActiveRegion({ userId: session.userId });
  const result = await Availability.deleteOne({
    _id: id,
    driverId: session.userId,
    regionCode: region.code,
    cityCode: region.cityCode,
  });

  if (result.deletedCount === 0)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ ok: true });
}

