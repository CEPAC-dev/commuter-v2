import { Types } from "mongoose";
import { AdminActivityNotification } from "@/models/AdminActivityNotification";
import { Payment } from "@/models/Payment";
import { Trip } from "@/models/Trip";
import { Request } from "@/models/Request";
import { User } from "@/models/User";
import { AdminReferralUsage } from "@/models/AdminReferralUsage";
import { sendPushPayloadToUser } from "@/lib/notifications/webPush";
import { latePaymentDedupeKey } from "@/lib/phase8bGuards";
import { waitingListTripBatchDedupeKey } from "@/lib/admin/waitingList";

function isDuplicateKeyError(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000,
  );
}

export async function notifyAdmins(input: {
  eventType:
    | "paid_trip_created"
    | "completed_paid_trip"
    | "waiting_list_trip_created"
    | "admin_campaign_claim"
    | "late_gateway_payment"
    | "station_suggestion_requested";
  dedupeKey: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}) {
  const admins = await User.find({ role: "admin" }).select("_id").lean();
  await Promise.all(
    admins.map(async (admin) => {
      try {
        const result = await AdminActivityNotification.updateOne(
          { adminId: admin._id, dedupeKey: input.dedupeKey },
          {
            $setOnInsert: {
              adminId: admin._id,
              ...input,
            },
          },
          { upsert: true },
        );
        if (result.upsertedCount > 0) {
          await sendPushPayloadToUser(String(admin._id), {
            id: input.dedupeKey,
            title: input.title,
            body: input.body,
            data: input.data,
            url:
              typeof input.data.href === "string"
                ? input.data.href
                : "/admin/alerts",
          });
        }
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
      }
    }),
  );
}

export async function notifyAdminsOfCompletedPaidTrip(tripId: string) {
  try {
    if (!Types.ObjectId.isValid(tripId)) return;
    const trip = await Trip.findOne({
      _id: tripId,
      status: "completed",
      paymentStatus: "paid",
    })
      .select("_id tripNumber userId date pickup dropoff priceEgp vehicleType")
      .lean();
    if (!trip) return;

    const user = await User.findById(trip.userId)
      .select("name userNumber phone email")
      .lean();
    const userName = user?.name ?? "Unknown user";
    await notifyAdmins({
      eventType: "completed_paid_trip",
      dedupeKey: `trip:${String(trip._id)}:completed_paid`,
      title: `Completed paid trip #${trip.tripNumber}`,
      body: `${userName} completed a paid trip (${trip.priceEgp} EGP).`,
      data: {
        tripId: String(trip._id),
        tripNumber: trip.tripNumber,
        userId: String(trip.userId),
        userName,
        userNumber: user?.userNumber ?? null,
        phone: user?.phone ?? "",
        email: user?.email ?? "",
        date: trip.date,
        priceEgp: trip.priceEgp,
        vehicleType: trip.vehicleType,
        pickup: trip.pickup?.address ?? "",
        dropoff: trip.dropoff?.address ?? "",
        href: "/admin/trips",
      },
    });
  } catch (error) {
    console.error("Admin completed-trip alert creation failed:", error);
  }
}

export async function notifyAdminsOfPaidTrip(tripId: string) {
  try {
    if (!Types.ObjectId.isValid(tripId)) return;
    const trip = await Trip.findOne({ _id: tripId, paymentStatus: "paid" })
      .select(
        "_id tripNumber userId date pickup dropoff priceEgp vehicleType status",
      )
      .lean();
    if (!trip) return;

    const user = await User.findById(trip.userId)
      .select("name userNumber phone email")
      .lean();
    const userName = user?.name ?? "Unknown user";
    await notifyAdmins({
      eventType: "paid_trip_created",
      dedupeKey: `trip:${String(trip._id)}:paid`,
      title: `New paid trip #${trip.tripNumber}`,
      body: `${userName} paid ${trip.priceEgp} EGP for a trip.`,
      data: {
        tripId: String(trip._id),
        tripNumber: trip.tripNumber,
        tripStatus: trip.status,
        userId: String(trip.userId),
        userName,
        userNumber: user?.userNumber ?? null,
        phone: user?.phone ?? "",
        email: user?.email ?? "",
        date: trip.date,
        priceEgp: trip.priceEgp,
        vehicleType: trip.vehicleType,
        pickup: trip.pickup?.address ?? "",
        dropoff: trip.dropoff?.address ?? "",
        href: "/admin/trips",
      },
    });
  } catch (error) {
    console.error("Admin paid-trip alert creation failed:", error);
  }
}

export async function notifyAdminsOfLateTripPayment(
  paymentId: string,
  tripId: string,
) {
  try {
    if (!Types.ObjectId.isValid(paymentId) || !Types.ObjectId.isValid(tripId))
      return;
    const [payment, trip] = await Promise.all([
      Payment.findById(paymentId)
        .select("userId gatewayAmountEgp kashierOrderId")
        .lean(),
      Trip.findOne({
        _id: tripId,
        status: { $in: ["cancelled", "time_out", "rejected"] },
      })
        .select("_id tripNumber userId status")
        .lean(),
    ]);
    if (!payment || !trip) return;

    const user = await User.findById(trip.userId)
      .select("name userNumber phone email")
      .lean();
    const userName = user?.name ?? "Unknown user";
    const gatewayAmountEgp = Number(payment.gatewayAmountEgp ?? 0);
    await notifyAdmins({
      eventType: "late_gateway_payment",
      dedupeKey: latePaymentDedupeKey(paymentId),
      title: `Late gateway charge for trip #${trip.tripNumber}`,
      body: `${userName} was charged ${gatewayAmountEgp} EGP after the trip became ${trip.status}.`,
      data: {
        paymentId,
        tripId,
        tripNumber: trip.tripNumber,
        tripStatus: trip.status,
        userId: String(trip.userId),
        userName,
        userNumber: user?.userNumber ?? null,
        email: user?.email ?? "",
        gatewayAmountEgp,
        kashierOrderId: payment.kashierOrderId ?? null,
        href: `/admin/transactions/${paymentId}`,
      },
    });
  } catch (error) {
    console.error("Admin late-payment alert creation failed:", error);
  }
}

export async function notifyAdminsOfRequestPaymentIssue(input: {
  paymentId: string;
  requestId: string;
  paidAmountEgp: number;
  expectedAmountEgp: number;
  reason: string;
}) {
  try {
    if (
      !Types.ObjectId.isValid(input.paymentId) ||
      !Types.ObjectId.isValid(input.requestId)
    ) {
      return;
    }
    await notifyAdmins({
      eventType: "late_gateway_payment",
      dedupeKey: latePaymentDedupeKey(input.paymentId),
      title: `Request payment needs review`,
      body: `Request ${input.requestId}: paid ${input.paidAmountEgp} EGP; expected ${input.expectedAmountEgp} EGP. ${input.reason}.`,
      data: {
        paymentId: input.paymentId,
        requestId: input.requestId,
        paidAmountEgp: input.paidAmountEgp,
        expectedAmountEgp: input.expectedAmountEgp,
        reason: input.reason,
        href: `/admin/transactions/${input.paymentId}`,
      },
    });
  } catch (error) {
    console.error("Admin Request payment alert creation failed:", error);
  }
}

export async function notifyAdminsOfWaitingListTrip(tripId: string) {
  try {
    if (!Types.ObjectId.isValid(tripId)) return;
    const trip = await Trip.findOne({
      _id: tripId,
      status: { $in: ["pending_payment", "waiting_list"] },
      paymentStatus: "pending",
    })
      .select(
        "_id tripNumber requestId userId date pickup dropoff priceEgp vehicleType",
      )
      .lean();
    if (!trip) return;

    let requestId: string | null = null;
    if (trip.requestId) {
      const request = await Request.findOne({
        _id: trip.requestId,
        status: "waiting_list",
      })
        .select("_id")
        .lean();
      if (!request) return;
      requestId = String(request._id);
    } else if (trip.status !== "waiting_list") {
      return;
    }

    const user = await User.findById(trip.userId)
      .select("name userNumber phone email")
      .lean();
    const userName = user?.name ?? "Unknown user";
    await notifyAdmins({
      eventType: "waiting_list_trip_created",
      dedupeKey: `trip:${String(trip._id)}:waiting_list_created`,
      title: `New waiting-list trip #${trip.tripNumber}`,
      body: `${userName} submitted a trip that needs waiting-list review.`,
      data: {
        tripId: String(trip._id),
        tripNumber: trip.tripNumber,
        ...(requestId ? { requestId } : { bookingId: String(trip._id) }),
        userId: String(trip.userId),
        userName,
        userNumber: user?.userNumber ?? null,
        phone: user?.phone ?? "",
        email: user?.email ?? "",
        date: trip.date,
        priceEgp: trip.priceEgp,
        vehicleType: trip.vehicleType,
        pickup: trip.pickup?.address ?? "",
        dropoff: trip.dropoff?.address ?? "",
        href: "/admin/waiting-list",
      },
    });
  } catch (error) {
    console.error("Admin waiting-list trip alert creation failed:", error);
  }
}

export async function notifyAdminsOfWaitingListTripBatch(input: {
  batchId: string;
  userId: string;
  tripCount: number;
  date: string;
  routeSummary: string;
}) {
  try {
    if (!Types.ObjectId.isValid(input.userId)) return;
    const user = await User.findById(input.userId)
      .select("name userNumber phone email")
      .lean();
    const userName = user?.name ?? "Unknown user";
    await notifyAdmins({
      eventType: "waiting_list_trip_created",
      dedupeKey: waitingListTripBatchDedupeKey(input.batchId),
      title: `${input.tripCount} new waiting-list trips`,
      body: `${userName} submitted ${input.tripCount} trips for waiting-list review.`,
      data: {
        batchId: input.batchId,
        userId: input.userId,
        userName,
        userNumber: user?.userNumber ?? null,
        phone: user?.phone ?? "",
        email: user?.email ?? "",
        date: input.date,
        tripCount: input.tripCount,
        routeSummary: input.routeSummary,
        href: "/admin/waiting-list",
      },
    });
  } catch (error) {
    console.error("Admin waiting-list batch alert creation failed:", error);
  }
}

export async function notifyAdminsOfWaitingListRequest(input: {
  requestId: string;
  userId: string;
  tripCount: number;
  date: string;
  routeSummary: string;
}) {
  try {
    if (
      !Types.ObjectId.isValid(input.requestId) ||
      !Types.ObjectId.isValid(input.userId)
    ) {
      return;
    }
    const user = await User.findById(input.userId)
      .select("name userNumber phone email")
      .lean();
    await notifyAdmins({
      eventType: "waiting_list_trip_created",
      dedupeKey: `request:${input.requestId}:waiting_list_created`,
      title: "New multi-day waiting-list Request",
      body: `${user?.name ?? "Unknown user"} submitted a ${input.tripCount}-day Request for review.`,
      data: {
        requestId: input.requestId,
        userId: input.userId,
        userName: user?.name ?? "Unknown user",
        userNumber: user?.userNumber ?? null,
        phone: user?.phone ?? "",
        email: user?.email ?? "",
        date: input.date,
        tripCount: input.tripCount,
        routeSummary: input.routeSummary,
        href: "/admin/waiting-list",
      },
    });
  } catch (error) {
    console.error("Admin waiting-list Request alert creation failed:", error);
  }
}

export async function syncPaidTripsForRequest(requestId: string) {
  await Trip.updateMany({ requestId }, { $set: { paymentStatus: "paid" } });
  await Trip.updateMany(
    { requestId, status: "pending_payment" },
    { $set: { status: "submitted" } },
  );

  try {
    const paidTrips = await Trip.find({ requestId, paymentStatus: "paid" })
      .select("_id")
      .lean();
    await Promise.all(
      paidTrips.map((trip) => notifyAdminsOfPaidTrip(String(trip._id))),
    );

    const completedTrips = await Trip.find({
      requestId,
      status: "completed",
      paymentStatus: "paid",
    })
      .select("_id")
      .lean();
    await Promise.all(
      completedTrips.map((trip) =>
        notifyAdminsOfCompletedPaidTrip(String(trip._id)),
      ),
    );
  } catch (error) {
    console.error("Admin paid-trip alert lookup failed:", error);
  }
}

export async function notifyAdminsOfAdminCampaignClaim(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return;
  const user = await User.findOne({
    _id: userId,
    referralClaimType: "admin_campaign",
  })
    .select("_id name userNumber phone email referralClaimedAt")
    .lean();
  if (!user) return;

  const usage = await AdminReferralUsage.findOne({ recipientUserId: user._id })
    .select("campaignId rewardAmount")
    .lean();

  await notifyAdmins({
    eventType: "admin_campaign_claim",
    dedupeKey: `campaign-claim:user:${String(user._id)}`,
    title: `Campaign reward claimed by ${user.name}`,
    body: `User #${user.userNumber ?? "—"} claimed an admin campaign reward${usage ? ` (${usage.rewardAmount} EGP)` : ""}.`,
    data: {
      userId: String(user._id),
      userName: user.name,
      userNumber: user.userNumber ?? null,
      phone: user.phone,
      email: user.email ?? "",
      claimedAt: user.referralClaimedAt?.toISOString?.() ?? null,
      rewardAmount: usage?.rewardAmount ?? null,
      campaignId: usage ? String(usage.campaignId) : null,
      href: "/admin/users",
    },
  });
}
