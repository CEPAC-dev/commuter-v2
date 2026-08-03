import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { getSession } from "@/lib/auth/session";

function isLocked(dateISO: string): boolean {
  const cutoff = new Date(`${dateISO}T20:00:00`);
  cutoff.setDate(cutoff.getDate() - 1);
  return new Date() >= cutoff;
}

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

  if (isLocked(record.date))
    return NextResponse.json(
      {
        error:
          "Cannot delete availability after 8:00 PM the day before. Contact support to change.",
      },
      { status: 403 },
    );

  await Availability.deleteOne({ _id: id, driverId: session.userId });

  return NextResponse.json({ ok: true });
}
