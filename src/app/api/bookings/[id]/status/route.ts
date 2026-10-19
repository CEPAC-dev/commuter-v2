import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getBookingStatus } from "@/lib/services/booking-status";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const booking = await getBookingStatus(session.userId, id);
  if (!booking)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ data: booking });
}
