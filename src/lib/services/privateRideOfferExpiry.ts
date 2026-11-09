import mongoose, { Types } from "mongoose";
import { createNotification } from "@/lib/notifications/createNotification";
import { releasePromoCodeUsageForTrip } from "@/lib/promoCode";
import { privateRideOfferExpiresAt } from "@/lib/privateRideOffer";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";

type ExpiringOfferTrip = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  requestId?: Types.ObjectId | null;
  date: string;
  privateRideOffer?: {
    offeredAt: Date | string;
    expiresAt?: Date | string | null;
  } | null;
};

const PRIVATE_RIDE_OFFER_EXPIRED_REASON =
  "The private-ride offer expired because the passenger did not respond by the deadline.";

export async function expirePrivateRideOffer(
  tripId: Types.ObjectId | string,
  now = new Date(),
  userId?: Types.ObjectId | string,
): Promise<boolean> {
  const tripObjectId =
    tripId instanceof Types.ObjectId ? tripId : new Types.ObjectId(tripId);
  const userObjectId =
    userId === undefined
      ? undefined
      : userId instanceof Types.ObjectId
        ? userId
        : new Types.ObjectId(userId);
  const dbSession = await mongoose.startSession();
  const expiryResult: { trip: ExpiringOfferTrip | null } = { trip: null };

  try {
    await dbSession.withTransaction(async () => {
      expiryResult.trip = await Trip.findOne({
        _id: tripObjectId,
        status: "private_ride_offered",
        ...(userObjectId ? { userId: userObjectId } : {}),
      })
        .session(dbSession)
        .lean<ExpiringOfferTrip | null>();
      const expiredTrip = expiryResult.trip;
      if (!expiredTrip?.privateRideOffer) return;

      const expiresAt = expiredTrip.privateRideOffer.expiresAt
        ? new Date(expiredTrip.privateRideOffer.expiresAt)
        : privateRideOfferExpiresAt(expiredTrip.privateRideOffer.offeredAt);
      if (!Number.isFinite(expiresAt.getTime())) {
        throw new Error(`Invalid private-ride offer deadline for trip ${tripId}.`);
      }
      if (expiresAt > now) {
        expiryResult.trip = null;
        return;
      }

      const updatedTrip = await Trip.updateOne(
        {
          _id: tripObjectId,
          status: "private_ride_offered",
          ...(userObjectId ? { userId: userObjectId } : {}),
        },
        {
          $set: {
            status: "cancelled",
            cancelledBy: "system",
            cancelReason: PRIVATE_RIDE_OFFER_EXPIRED_REASON,
            cancellation: {
              cancelledAt: now,
              tierLabel: "passenger_cancellation",
              refundPercent: 0,
              penaltyPercent: 0,
              refundAmount: 0,
              retainedAmount: 0,
              refundStatus: "none",
              reason: PRIVATE_RIDE_OFFER_EXPIRED_REASON,
            },
            "privateRideOffer.expiresAt": expiresAt,
            "privateRideOffer.decision": "expired",
            "privateRideOffer.respondedAt": now,
          },
        },
        { session: dbSession },
      );
      if (updatedTrip.modifiedCount !== 1) {
        expiryResult.trip = null;
        return;
      }

      if (expiredTrip.requestId) {
        const siblings = await Trip.find({
          requestId: expiredTrip.requestId,
          userId: expiredTrip.userId,
          _id: { $ne: tripObjectId },
          status: { $ne: "cancelled" },
        })
          .select("_id date priceEgp")
          .session(dbSession)
          .lean<{ _id: Types.ObjectId; date: string; priceEgp: number }[]>();
        const updatedRequest = await Request.findOneAndUpdate(
          {
            _id: expiredTrip.requestId,
            userId: expiredTrip.userId,
            status: "waiting_list",
          },
          {
            $set: {
              amountEgp: siblings.reduce((sum, sibling) => sum + sibling.priceEgp, 0),
              dates: siblings.length
                ? Array.from(new Set(siblings.map((sibling) => sibling.date)))
                : [expiredTrip.date],
              tripIds: siblings.map((sibling) => sibling._id),
              ...(siblings.length === 0 ? { status: "cancelled" } : {}),
            },
          },
          { session: dbSession },
        ).lean();
        if (!updatedRequest) {
          throw new Error(
            `Could not update request ${expiredTrip.requestId} after private-offer expiry.`,
          );
        }
      }

      await releasePromoCodeUsageForTrip(tripObjectId, dbSession);
    });
  } catch (error) {
    console.error(
      `[Private ride offer expiry] Failed to expire trip ${tripId}:`,
      error,
    );
    throw error;
  } finally {
    await dbSession.endSession();
  }

  const expiredTrip = expiryResult.trip;
  if (!expiredTrip) return false;

  try {
    await createNotification({
      userId: String(expiredTrip.userId),
      type: "request_cancelled",
      title: "Private-ride offer expired",
      body: "Your trip was automatically cancelled because you did not respond by 7:00 PM Cairo time.",
      titleAr: "انتهى عرض الرحلة الخاصة",
      bodyAr: "تم إلغاء رحلتك تلقائيًا لعدم الرد قبل الساعة 7:00 مساءً بتوقيت القاهرة.",
      data: {
        bookingId: String(expiredTrip.requestId ?? expiredTrip._id),
        tripId: String(expiredTrip._id),
        linkUrl: `/my-trips/${expiredTrip._id}`,
        linkLabel: "View cancelled trip",
      },
    });
  } catch (error) {
    console.error(
      `[Private ride offer expiry] Cancellation notification failed for trip ${expiredTrip._id}:`,
      error,
    );
  }

  return true;
}

export async function expireDuePrivateRideOffers(now = new Date()): Promise<number> {
  const candidates = await Trip.find({
    status: "private_ride_offered",
    $or: [
      { "privateRideOffer.expiresAt": { $lte: now } },
      {
        "privateRideOffer.expiresAt": { $exists: false },
        "privateRideOffer.offeredAt": { $lte: now },
      },
    ],
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>();

  let expiredCount = 0;
  for (const candidate of candidates) {
    if (await expirePrivateRideOffer(candidate._id, now)) expiredCount += 1;
  }
  return expiredCount;
}
