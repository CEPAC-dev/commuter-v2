import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { PromoCode } from "@/models/PromoCode";
import { PromoCodeUsage } from "@/models/PromoCodeUsage";
import { getCairoNowParts } from "@/lib/cancellationPolicy";
import { createNotification } from "@/lib/notifications/createNotification";
import {
  buildWaitingListApprovedNotification,
  buildWaitingListRejectedNotification,
  buildWaitingListReviewUpdate,
  buildWaitingListTransitionFilter,
  buildWaitingListTripCancellationUpdate,
  groupPromoUsageCounts,
  hasPastWaitingListTrip,
  validateWaitingListAction,
} from "@/lib/admin/waitingList";

const WAITING_LIST_CONFLICT = "WAITING_LIST_CONFLICT";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid request id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = validateWaitingListAction(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await connectDB();
  const existing = await Request.findById(id).select("status").lean<{ status?: string }>();
  if (!existing) {
    return NextResponse.json({ error: "Waiting-list request not found." }, { status: 404 });
  }
  if (existing.status !== "waiting_list") {
    return NextResponse.json(
      { error: "This request has already been decided." },
      { status: 409 },
    );
  }

  if (parsed.value.action === "approve") {
    const trips = await Trip.find({ requestId: new Types.ObjectId(id) })
      .select("date pickupTime arrivalTime")
      .lean<{ date: string; pickupTime: string; arrivalTime: string }[]>();
    if (hasPastWaitingListTrip(trips, getCairoNowParts())) {
      return NextResponse.json(
        {
          errorCode: "WAITING_LIST_TRIP_IN_PAST",
          error: "This request includes a trip whose pickup time has already passed.",
        },
        { status: 409 },
      );
    }
  }

  const reviewedAt = new Date();
  const adminId = new Types.ObjectId(auth.userId);
  const dbSession = await mongoose.startSession();
  let reviewedRequest: any = null;

  try {
    await dbSession.withTransaction(async () => {
      reviewedRequest = await Request.findOneAndUpdate(
        buildWaitingListTransitionFilter(new Types.ObjectId(id)),
        buildWaitingListReviewUpdate(
          parsed.value.action,
          adminId,
          reviewedAt,
          parsed.value.reason,
        ),
        { new: true, session: dbSession },
      );

      if (!reviewedRequest) throw new Error(WAITING_LIST_CONFLICT);

      if (parsed.value.action !== "reject") return;

      const cancellationReason = parsed.value.reason || "Rejected by admin";
      await Trip.updateMany(
        { requestId: new Types.ObjectId(id), status: "pending_payment" },
        buildWaitingListTripCancellationUpdate(reviewedAt, cancellationReason),
        { session: dbSession },
      );

      const requestTrips = await Trip.find({ requestId: new Types.ObjectId(id) })
        .select("_id")
        .session(dbSession)
        .lean<{ _id: Types.ObjectId }[]>();
      const tripIds = requestTrips.map((trip) => trip._id);
      if (tripIds.length === 0) return;

      const usages = await PromoCodeUsage.find({ trip: { $in: tripIds } })
        .select("_id promoCode")
        .session(dbSession)
        .lean<{ _id: Types.ObjectId; promoCode: Types.ObjectId }[]>();
      if (usages.length === 0) return;

      const usageCountByPromo = groupPromoUsageCounts(usages);
      for (const [promoId, count] of usageCountByPromo) {
        for (let index = 0; index < count; index += 1) {
          await PromoCode.updateOne(
            { _id: new Types.ObjectId(promoId), usedCount: { $gt: 0 } },
            { $inc: { usedCount: -1 } },
            { session: dbSession },
          );
        }
      }
      await PromoCodeUsage.deleteMany(
        { _id: { $in: usages.map((usage) => usage._id) } },
        { session: dbSession },
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === WAITING_LIST_CONFLICT) {
      const current = await Request.findById(id).select("status").lean<{ status?: string }>();
      return NextResponse.json(
        {
          error: current ? "This request has already been decided." : "Waiting-list request not found.",
        },
        { status: current ? 409 : 404 },
      );
    }
    console.error(`[Admin waiting list] Failed to ${parsed.value.action} request ${id}:`, error);
    return NextResponse.json(
      { error: "Could not update the waiting-list request." },
      { status: 500 },
    );
  } finally {
    await dbSession.endSession();
  }

  try {
    const passengerId = String(reviewedRequest.userId);
    const notification = parsed.value.action === "approve"
      ? buildWaitingListApprovedNotification(passengerId, id)
      : buildWaitingListRejectedNotification(passengerId, id, parsed.value.reason);
    await createNotification(notification);
  } catch (error) {
    console.error(`[Admin waiting list] Notification failed for request ${id}:`, error);
  }

  return NextResponse.json({
    data: {
      id: String(reviewedRequest._id),
      status: reviewedRequest.status,
      reviewedBy: String(reviewedRequest.reviewedBy),
      reviewedAt: reviewedRequest.reviewedAt,
      rejectionReason: reviewedRequest.rejectionReason ?? null,
    },
  });
}
