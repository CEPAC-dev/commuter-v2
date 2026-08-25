import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  reconcilePendingTopups,
  reconcileStaleReservations,
} from "@/lib/payments/kashier";

export async function POST() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const credited = await reconcilePendingTopups(session.userId);
  const { released, settled } = await reconcileStaleReservations(
    session.userId,
  );
  return NextResponse.json({ credited, released, settled });
}
