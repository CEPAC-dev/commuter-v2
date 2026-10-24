import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { releasePromoCodeUsageForTrip } from "@/lib/promoCode";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";

const PRIVATE_RIDE_OFFER_CONFLICT = "PRIVATE_RIDE_OFFER_CONFLICT";

type OfferTrip = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  requestId?: Types.ObjectId | null;
  date: string;
  priceEgp: number;
  status: string;
  privateRideOffer?: {
    vehicleType: "private_car" | "taxi_private";
    priceEgp: number;
    offeredBy: Types.ObjectId;
  } | null;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.role === "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid trip id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const action =
    body && typeof body === "object" && "action" in body
      ? (body as { action?: unknown }).action
      : undefined;
  if (action !== "accept" && action !== "cancel") {
    return NextResponse.json(
      { error: "action must be accept or cancel." },
      { status: 400 },
    );
  }

  await connectDB();
  const tripId = new Types.ObjectId(id);
  const userId = new Types.ObjectId(session.userId);
  const dbSession = await mongoose.startSession();
  let result: { status: string; requestId: string | null } | null = null;

  try {
    await dbSession.withTransaction(async () => {
      const trip = await Trip.findOne({
        _id: tripId,
        userId,
        status: "private_ride_offered",
      })
        .session(dbSession)
        .lean<OfferTrip | null>();

      if (!trip?.privateRideOffer) {
        throw new Error(PRIVATE_RIDE_OFFER_CONFLICT);
      }

      const requestId = trip.requestId ?? null;
      const parentRequest = requestId
        ? await Request.findOne({
            _id: requestId,
            userId,
            status: "waiting_list",
            paymentStatus: { $in: ["pending", "failed"] },
          })
            .session(dbSession)
            .lean<{
              _id: Types.ObjectId;
              status: string;
              paymentStatus: string;
              regionCode?: string | null;
              currencyCode?: string;
              note?: string;
            } | null>()
        : null;

      if (requestId && !parentRequest) {
        throw new Error(PRIVATE_RIDE_OFFER_CONFLICT);
      }

      const remainingTrips = requestId
        ? await Trip.find({
            requestId,
            userId,
            _id: { $ne: tripId },
            status: { $ne: "cancelled" },
          })
            .select("_id date priceEgp")
            .session(dbSession)
            .lean<{ _id: Types.ObjectId; date: string; priceEgp: number }[]>()
        : [];
      const now = new Date();

      if (action === "accept") {
        await releasePromoCodeUsageForTrip(tripId, dbSession);

        let resolvedRequestId = requestId;
        let tripStatus = "approved";

        if (requestId && parentRequest && remainingTrips.length > 0) {
          const remainingAmount = remainingTrips.reduce(
            (sum, sibling) => sum + sibling.priceEgp,
            0,
          );
          const updatedParent = await Request.findOneAndUpdate(
            { _id: requestId, userId, status: "waiting_list" },
            {
              $set: {
                amountEgp: remainingAmount,
                dates: Array.from(new Set(remainingTrips.map((item) => item.date))),
                tripIds: remainingTrips.map((item) => item._id),
              },
            },
            { new: true, session: dbSession },
          ).lean();
          if (!updatedParent) throw new Error(PRIVATE_RIDE_OFFER_CONFLICT);

          const newRequest = new Request({
            userId,
            regionCode: parentRequest.regionCode ?? null,
            currencyCode: parentRequest.currencyCode ?? "EGP",
            tripIds: [tripId],
            dates: [trip.date],
            amountEgp: trip.privateRideOffer.priceEgp,
            note: parentRequest.note ?? "",
            reviewedBy: trip.privateRideOffer.offeredBy,
            reviewedAt: now,
            paymentStatus: "pending",
            status: "approved",
          });
          newRequest.$locals.groupCreationApproved = true;
          newRequest.$session(dbSession);
          await newRequest.save({ session: dbSession });
          resolvedRequestId = newRequest._id;
          tripStatus = "pending_payment";
        } else if (requestId) {
          const approvedParent = await Request.findOneAndUpdate(
            { _id: requestId, userId, status: "waiting_list" },
            {
              $set: {
                amountEgp: trip.privateRideOffer.priceEgp,
                dates: [trip.date],
                tripIds: [tripId],
                status: "approved",
                reviewedBy: trip.privateRideOffer.offeredBy,
                reviewedAt: now,
              },
            },
            { new: true, session: dbSession },
          ).lean();
          if (!approvedParent) throw new Error(PRIVATE_RIDE_OFFER_CONFLICT);
          tripStatus = "pending_payment";
        }

        const updatedTrip = await Trip.findOneAndUpdate(
          { _id: tripId, userId, status: "private_ride_offered" },
          {
            $set: {
              ...(resolvedRequestId ? { requestId: resolvedRequestId } : {}),
              vehicleType: trip.privateRideOffer.vehicleType,
              rideType: "private",
              priceEgp: trip.privateRideOffer.priceEgp,
              basePriceEgp: trip.privateRideOffer.priceEgp,
              status: tripStatus,
              "privateRideOffer.decision": "accepted",
              "privateRideOffer.respondedAt": now,
            },
            $unset: {
              appliedPromoCode: 1,
              promoDiscountType: 1,
              promoDiscountValue: 1,
              promoDiscountAmountEgp: 1,
            },
          },
          { new: true, session: dbSession },
        ).lean();

        if (!updatedTrip) throw new Error(PRIVATE_RIDE_OFFER_CONFLICT);
        result = {
          status: tripStatus,
          requestId: resolvedRequestId ? String(resolvedRequestId) : null,
        };
        return;
      }

      await releasePromoCodeUsageForTrip(tripId, dbSession);
      const cancellationReason =
        "Passenger declined the private-ride offer and cancelled this trip.";
      const cancelledTrip = await Trip.findOneAndUpdate(
        { _id: tripId, userId, status: "private_ride_offered" },
        {
          $set: {
            status: "cancelled",
            cancelledBy: "passenger",
            cancelReason: cancellationReason,
            cancellation: {
              cancelledAt: now,
              tierLabel: "passenger_cancellation",
              refundPercent: 0,
              penaltyPercent: 0,
              refundAmount: 0,
              retainedAmount: 0,
              refundStatus: "none",
              reason: cancellationReason,
            },
            "privateRideOffer.decision": "cancelled",
            "privateRideOffer.respondedAt": now,
          },
        },
        { new: true, session: dbSession },
      ).lean();
      if (!cancelledTrip) throw new Error(PRIVATE_RIDE_OFFER_CONFLICT);

      if (requestId && parentRequest) {
        const remainingAmount = remainingTrips.reduce(
          (sum, sibling) => sum + sibling.priceEgp,
          0,
        );
        const updatedParent = await Request.findOneAndUpdate(
          { _id: requestId, userId, status: "waiting_list" },
          {
            $set: {
              amountEgp: remainingAmount,
              dates: remainingTrips.length
                ? Array.from(new Set(remainingTrips.map((item) => item.date)))
                : [trip.date],
              tripIds: remainingTrips.map((item) => item._id),
              ...(remainingTrips.length === 0 ? { status: "cancelled" } : {}),
            },
          },
          { new: true, session: dbSession },
        ).lean();
        if (!updatedParent) throw new Error(PRIVATE_RIDE_OFFER_CONFLICT);
      }

      result = {
        status: "cancelled",
        requestId: requestId ? String(requestId) : null,
      };
    });
  } catch (error) {
    if (error instanceof Error && error.message === PRIVATE_RIDE_OFFER_CONFLICT) {
      return NextResponse.json(
        {
          errorCode: "PRIVATE_RIDE_RESPONSE_CONFLICT",
          error: "This private-ride offer is no longer available.",
        },
        { status: 409 },
      );
    }
    console.error(`[Private ride offer] Failed to ${action} trip ${id}:`, error);
    return NextResponse.json(
      { error: "Could not update this trip." },
      { status: 500 },
    );
  } finally {
    await dbSession.endSession();
  }

  if (!result) {
    return NextResponse.json(
      { error: "The trip was not updated." },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: result });
}
