import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserTrip } from "@/lib/services/trips";
import { getTripDetailViewState } from "@/lib/statusDisplay.ts";
import { canShare } from "@/lib/liveShare/eligibility";
import { TripReport } from "@/models/TripReport";
import { TripShare } from "@/models/TripShare";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const trip = await getUserTrip(session.userId, id, true);

  if (!trip) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const [hasReport, hasActiveLiveShare] = await Promise.all([
    TripReport.exists({ tripId: trip.id, userId: session.userId }),
    TripShare.exists({
      tripId: trip.id,
      userId: session.userId,
      active: true,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }),
  ]);
  const liveShareEligible = canShare(
    {
      userId: trip.userId,
      driverId: trip.driverId,
      status: trip.status,
    },
    session.userId,
    trip.rideDetails,
  );
  const { displayStatus, availableActions } = getTripDetailViewState({
    request: {
      status: trip.parentRequestStatus ?? trip.status,
      paymentStatus: trip.parentPaymentStatus ?? trip.paymentStatus,
      rejectionReason: trip.rejectionReason,
      hasPastTrip: trip.hasPastTrip,
    },
    trip,
    hasReport: Boolean(hasReport),
    liveShareEligible,
    hasActiveLiveShare: Boolean(hasActiveLiveShare),
  });

  return NextResponse.json(
    {
      data: {
        ...trip,
        hasReport: Boolean(hasReport),
        displayStatus,
        availableActions,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
