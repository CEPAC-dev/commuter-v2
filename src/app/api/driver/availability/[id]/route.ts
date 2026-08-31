import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { getSession } from "@/lib/auth/session";
import { canModifyAvailability, getAdminSettings } from "@/lib/cancellationPolicy";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "driver")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await connectDB();
  const record = await Availability.findOne({
    _id: id,
    driverId: session.userId,
  })
    .select("date")
    .lean<{ date: string }>();

  if (!record)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  const settings = await getAdminSettings();

  if (!canModifyAvailability(record.date, new Date(), settings.availabilityLockTime)) {
    return NextResponse.json(
      {
        error: `Availability can only be edited or deleted before ${settings.availabilityLockTime} on the day before.`,
      },
      { status: 403 },
    );
  }

  await Availability.deleteOne({ _id: id, driverId: session.userId });

  return NextResponse.json({ ok: true });
}
