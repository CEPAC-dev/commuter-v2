import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { getCairoNowParts } from "@/lib/cancellationPolicy";
import { createNotification } from "@/lib/notifications/createNotification";
import {
  releasePromoCodeUsageForTrip,
  releasePromoForRequest,
} from "@/lib/promoCode";
import {
  buildWaitingListApprovedNotification,
  buildWaitingListRejectedNotification,
  buildWaitingListReviewUpdate,
  buildWaitingListTripTransitionFilter,
  buildWaitingListTransitionFilter,
  buildWaitingListTripCancellationUpdate,
  hasPastWaitingListTrip,
  validateWaitingListAction,
} from "@/lib/admin/waitingList";

const WAITING_LIST_CONFLICT = "WAITING_LIST_CONFLICT";
const WAITING_LIST_TRIP_CONFLICT = "WAITING_LIST_TRIP_CONFLICT";

type ReviewedTrip = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  status: string;
  reviewedBy: Types.ObjectId;
  reviewedAt: Date;
  rejectionReason?: string | null;
};

type ReviewedRequest = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tripIds?: Types.ObjectId[];
  status: string;
  reviewedBy: Types.ObjectId;
  reviewedAt: Date;
  rejectionReason?: string | null;
};

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
  const tripId = new Types.ObjectId(id);
  const standaloneTrip = await Trip.findOne({ _id: tripId, requestId: null })
    .select("_id userId status date pickupTime")
    .lean<{
      _id: Types.ObjectId;
      userId: Types.ObjectId;
      status: string;
      date: string;
      pickupTime: string;
    } | null>();

  if (standaloneTrip) {
    if (standaloneTrip.status !== "waiting_list") {
      return NextResponse.json(
        {
          errorCode: "WAITING_LIST_CONFLICT",
          error: "This trip has already been decided.",
          errorAr: "تمت مراجعة الرحلة دي بالفعل.",
        },
        { status: 409 },
      );
    }

    if (
      parsed.value.action === "approve" &&
      hasPastWaitingListTrip(
        [{ date: standaloneTrip.date, pickupTime: standaloneTrip.pickupTime }],
        getCairoNowParts(),
      )
    ) {
      return NextResponse.json(
        {
          errorCode: "WAITING_LIST_TRIP_IN_PAST",
          error: "This trip's pickup time has already passed.",
          errorAr: "موعد ركوب الرحلة دي عدى بالفعل.",
        },
        { status: 409 },
      );
    }

    const reviewedAt = new Date();
    const adminId = new Types.ObjectId(auth.userId);
    const dbSession = await mongoose.startSession();
    const reviewResult: { trip: ReviewedTrip | null } = { trip: null };

    try {
      await dbSession.withTransaction(async () => {
        reviewResult.trip = await Trip.findOneAndUpdate(
          buildWaitingListTripTransitionFilter(tripId),
          buildWaitingListReviewUpdate(
            parsed.value.action,
            adminId,
            reviewedAt,
            parsed.value.reason,
          ),
          { new: true, session: dbSession },
        ).lean<ReviewedTrip | null>();
        if (!reviewResult.trip) throw new Error(WAITING_LIST_TRIP_CONFLICT);
        if (parsed.value.action === "reject") {
          await releasePromoCodeUsageForTrip(tripId, dbSession);
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message === WAITING_LIST_TRIP_CONFLICT) {
        const currentTrip = await Trip.findOne({ _id: tripId, requestId: null })
          .select("_id")
          .lean();
        return NextResponse.json(
          {
            ...(currentTrip ? { errorCode: "WAITING_LIST_CONFLICT" } : {}),
            error: currentTrip
              ? "This trip has already been decided."
              : "Waiting-list trip not found.",
            ...(currentTrip ? { errorAr: "تمت مراجعة الرحلة دي بالفعل." } : {}),
          },
          { status: currentTrip ? 409 : 404 },
        );
      }
      throw error;
    } finally {
      await dbSession.endSession();
    }

    const reviewedTrip = reviewResult.trip;
    if (!reviewedTrip) {
      const currentTrip = await Trip.findOne({ _id: tripId, requestId: null })
        .select("_id")
        .lean();
      return NextResponse.json(
        {
          ...(currentTrip ? { errorCode: "WAITING_LIST_CONFLICT" } : {}),
          error: currentTrip
            ? "This trip has already been decided."
            : "Waiting-list trip not found.",
          ...(currentTrip ? { errorAr: "تمت مراجعة الرحلة دي بالفعل." } : {}),
        },
        { status: currentTrip ? 409 : 404 },
      );
    }

    try {
      const passengerId = String(reviewedTrip.userId);
      const notification = parsed.value.action === "approve"
        ? buildWaitingListApprovedNotification(passengerId, id, id)
        : buildWaitingListRejectedNotification(
            passengerId,
            id,
            id,
            parsed.value.reason,
          );
      await createNotification(notification);
    } catch (error) {
      console.error(`[Admin waiting list] Notification failed for trip ${id}:`, error);
    }

    return NextResponse.json({
      data: {
        id: String(reviewedTrip._id),
        status: reviewedTrip.status,
        reviewedBy: String(reviewedTrip.reviewedBy),
        reviewedAt: reviewedTrip.reviewedAt,
        rejectionReason: reviewedTrip.rejectionReason ?? null,
      },
    });
  }

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
  const reviewResult: { request: ReviewedRequest | null } = {
    request: null,
  };

  try {
    await dbSession.withTransaction(async () => {
      reviewResult.request = await Request.findOneAndUpdate(
        buildWaitingListTransitionFilter(new Types.ObjectId(id)),
        buildWaitingListReviewUpdate(
          parsed.value.action,
          adminId,
          reviewedAt,
          parsed.value.reason,
        ),
        { new: true, session: dbSession },
      ).lean<ReviewedRequest | null>();

      if (!reviewResult.request) throw new Error(WAITING_LIST_CONFLICT);

      if (parsed.value.action !== "reject") return;

      const cancellationReason = parsed.value.reason || "Rejected by admin";
      await Trip.updateMany(
        { requestId: new Types.ObjectId(id), status: "pending_payment" },
        buildWaitingListTripCancellationUpdate(reviewedAt, cancellationReason),
        { session: dbSession },
      );

      await releasePromoForRequest(id, { session: dbSession });
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

  const reviewedRequest = reviewResult.request;
  if (!reviewedRequest) {
    return NextResponse.json(
      { error: "Waiting-list request was not updated." },
      { status: 500 },
    );
  }

  try {
    const passengerId = String(reviewedRequest.userId);
    const representativeTripId = reviewedRequest.tripIds?.[0]
      ? String(reviewedRequest.tripIds[0])
      : String(
          (
            await Trip.findOne({ requestId: new Types.ObjectId(id) })
              .sort({ date: 1, cycleIndex: 1 })
              .select("_id")
              .lean<{ _id: Types.ObjectId } | null>()
          )?._id ?? "",
        );
    if (!representativeTripId) {
      throw new Error("Request has no Trip to use for its notification link.");
    }
    const notification = parsed.value.action === "approve"
      ? buildWaitingListApprovedNotification(passengerId, id, representativeTripId)
      : buildWaitingListRejectedNotification(passengerId, id, representativeTripId, parsed.value.reason);
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
