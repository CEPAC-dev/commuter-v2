import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { Vehicle } from "@/models/Vehicle";
import { getCairoNowParts } from "@/lib/cancellationPolicy";
import { createNotification } from "@/lib/notifications/createNotification";
import {
  privateRideCounterpart,
  privateRidePrice,
} from "@/lib/privateRideOffer";
import {
  releasePromoCodeUsageForTrip,
  releasePromoForRequest,
} from "@/lib/promoCode";
import { isRegionKey, normalizeRegion } from "@/lib/config/regions";
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
const PRIVATE_RIDE_OFFER_CONFLICT = "PRIVATE_RIDE_OFFER_CONFLICT";
const PRIVATE_RIDE_RESPONSE_PENDING = "PRIVATE_RIDE_RESPONSE_PENDING";

async function createPrivateRideOffer(
  requestId: string,
  tripId: string,
  adminId: string,
) {
  if (!Types.ObjectId.isValid(tripId)) {
    return NextResponse.json({ error: "Invalid trip id." }, { status: 400 });
  }

  const tripObjectId = new Types.ObjectId(tripId);
  const trip = await Trip.findById(tripObjectId)
    .select("_id userId requestId status date pickupTime vehicleType distanceKm regionCode")
    .lean<{
      _id: Types.ObjectId;
      userId: Types.ObjectId;
      requestId?: Types.ObjectId | null;
      status: string;
      date: string;
      pickupTime: string;
      vehicleType: string;
      distanceKm: number;
      regionCode?: string | null;
    } | null>();

  if (!trip) {
    return NextResponse.json({ error: "Waiting-list trip not found." }, { status: 404 });
  }
  if (String(trip.requestId ?? trip._id) !== requestId) {
    return NextResponse.json({ error: "Trip does not belong to this request." }, { status: 404 });
  }

  let regionCode = isRegionKey(trip.regionCode)
    ? normalizeRegion(trip.regionCode)
    : null;
  if (!regionCode && trip.requestId) {
    const parentRequest = await Request.findById(trip.requestId)
      .select("regionCode")
      .lean<{ regionCode?: string | null } | null>();
    if (isRegionKey(parentRequest?.regionCode)) {
      regionCode = normalizeRegion(parentRequest.regionCode);
    }
  }

  const privateVehicleType = privateRideCounterpart(trip.vehicleType);
  if (!privateVehicleType) {
    return NextResponse.json(
      {
        errorCode: "PRIVATE_RIDE_CONVERSION_UNAVAILABLE",
        error: "This shared vehicle has no private equivalent.",
      },
      { status: 409 },
    );
  }

  if (
    hasPastWaitingListTrip(
      [{ date: trip.date, pickupTime: trip.pickupTime }],
      getCairoNowParts(),
    )
  ) {
    return NextResponse.json(
      {
        errorCode: "WAITING_LIST_TRIP_IN_PAST",
        error: "This trip's pickup time has already passed.",
      },
      { status: 409 },
    );
  }

  const vehicle = await Vehicle.findOne({ key: privateVehicleType })
    .select("active regionConfigs")
    .lean<{
      active?: boolean;
      regionConfigs?: {
        regionCode: string;
        rate: number;
        active: boolean;
        pricingConfigured: boolean;
      }[];
    } | null>();
  const regionPricing = vehicle?.regionConfigs?.find(
    (config) => config.regionCode === regionCode,
  );
  if (
    !vehicle ||
    vehicle.active === false ||
    !regionCode ||
    !regionPricing ||
    !regionPricing.active ||
    !regionPricing.pricingConfigured ||
    !Number.isFinite(regionPricing.rate)
  ) {
    return NextResponse.json(
      {
        errorCode: "PRIVATE_RIDE_PRICING_UNAVAILABLE",
        error: "Private-ride pricing is not configured for this trip's region.",
      },
      { status: 409 },
    );
  }

  const priceEgp = privateRidePrice(trip.distanceKm, regionPricing.rate);
  const offeredAt = new Date();
  const dbSession = await mongoose.startSession();

  try {
    await dbSession.withTransaction(async () => {
      const expectedStatus = trip.requestId ? "pending_payment" : "waiting_list";
      if (trip.requestId) {
        const parentLock = await Request.updateOne(
          { _id: trip.requestId, status: "waiting_list" },
          { $inc: { __v: 1 } },
          { session: dbSession },
        );
        if (parentLock.matchedCount !== 1) {
          throw new Error(PRIVATE_RIDE_OFFER_CONFLICT);
        }
      }

      const offeredTrip = await Trip.findOneAndUpdate(
        {
          _id: tripObjectId,
          userId: trip.userId,
          requestId: trip.requestId ?? null,
          status: expectedStatus,
        },
        {
          $set: {
            status: "private_ride_offered",
            privateRideOffer: {
              vehicleType: privateVehicleType,
              priceEgp,
              offeredBy: new Types.ObjectId(adminId),
              offeredAt,
              respondedAt: null,
              decision: null,
            },
          },
        },
        { new: true, session: dbSession },
      ).lean();

      if (!offeredTrip) throw new Error(PRIVATE_RIDE_OFFER_CONFLICT);
    });
  } catch (error) {
    if (error instanceof Error && error.message === PRIVATE_RIDE_OFFER_CONFLICT) {
      return NextResponse.json(
        {
          errorCode: "WAITING_LIST_TRIP_CONFLICT",
          error: "This trip has already been reviewed.",
        },
        { status: 409 },
      );
    }
    console.error(
      `[Admin waiting list] Failed to offer a private ride for trip ${tripId}:`,
      error,
    );
    return NextResponse.json(
      { error: "Could not create the private-ride offer." },
      { status: 500 },
    );
  } finally {
    await dbSession.endSession();
  }

  try {
    await createNotification({
      userId: String(trip.userId),
      type: "private_ride_offer",
      title: "A private-ride option is available",
      body: `We couldn't find available passengers in your area for this shared trip. You can switch to a private ride for ${priceEgp} EGP or cancel the trip.`,
      titleAr: "يتوفر خيار رحلة خاصة",
      bodyAr: `لم نتمكن من العثور على ركاب متاحين في منطقتك لهذه الرحلة المشتركة. يمكنك تحويلها إلى رحلة خاصة مقابل ${priceEgp} جنيه أو إلغاء الرحلة.`,
      data: {
        bookingId: String(trip.requestId ?? trip._id),
        tripId,
        priceEgp,
        vehicleType: privateVehicleType,
        linkUrl: `/my-trips/${tripId}`,
        linkLabel: "Review private-ride option",
      },
    });
  } catch (error) {
    console.error(
      `[Admin waiting list] Private-ride offer notification failed for trip ${tripId}:`,
      error,
    );
  }

  return NextResponse.json({
    data: {
      tripId,
      status: "private_ride_offered",
      vehicleType: privateVehicleType,
      priceEgp,
    },
  });
}

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
  if (parsed.value.action === "offer_private") {
    const tripId = parsed.value.tripId;
    if (!tripId) {
      return NextResponse.json(
        { error: "tripId is required for a private-ride offer." },
        { status: 400 },
      );
    }
    return createPrivateRideOffer(id, tripId, auth.userId);
  }

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
  if (
    await Trip.exists({
      requestId: new Types.ObjectId(id),
      status: "private_ride_offered",
    })
  ) {
    return NextResponse.json(
      {
        errorCode: "PRIVATE_RIDE_RESPONSE_PENDING",
        error:
          "Wait for the passenger to respond to the private-ride offer before reviewing this request.",
      },
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
      if (
        await Trip.exists({
          requestId: new Types.ObjectId(id),
          status: "private_ride_offered",
        }).session(dbSession)
      ) {
        throw new Error(PRIVATE_RIDE_RESPONSE_PENDING);
      }

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
    if (
      error instanceof Error &&
      error.message === PRIVATE_RIDE_RESPONSE_PENDING
    ) {
      return NextResponse.json(
        {
          errorCode: "PRIVATE_RIDE_RESPONSE_PENDING",
          error:
            "Wait for the passenger to respond to the private-ride offer before reviewing this request.",
        },
        { status: 409 },
      );
    }
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
