import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserTrip } from "@/lib/services/trips";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const trip = await getUserTrip(session.userId, id);

  if (!trip) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json(
    { data: trip },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
