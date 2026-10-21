import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { DEFAULT_REGION, getCurrencyConfig } from "@/lib/config/regions";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { Payment } from "@/models/Payment";
import {
  getOrCreateWallet,
  reserveWallet,
  releaseReservation,
} from "@/lib/wallet/wallet";
import { createNotification } from "@/lib/notifications/createNotification";
import { notifyAdminsOfPaidTrip } from "@/lib/notifications/adminActivity";
import mongoose, { Types } from "mongoose";
import { validateMutationRequest } from "@/lib/security/request";
import { getCairoNowParts } from "@/lib/cancellationPolicy";
import { hasPastTrip } from "@/lib/admin/waitingList";
import {
  isApprovedTripPickupPast,
  isStandaloneTripPayable,
  resolvePayableBooking,
} from "@/lib/payments/resolveBooking";
import { getRequestPaymentSessionBlock } from "@/lib/payments/requestSessionEligibility";
import { settleStandaloneTripPayment } from "@/lib/payments/standaloneTripSettlement";
import { settleRequestPayment } from "@/lib/payments/requestSettlement";
import { shouldResetFailedTripForRetry } from "@/lib/payments/settlementAttempt";
import { safeKashierErrorFields } from "@/lib/phase8bGuards";
import {
  canContinueStandaloneTripPayment,
  formatKashierAmount,
  splitTripPaymentAmount,
  validatePaymentAppUrl,
} from "@/lib/payments/sessionGuards";
import { KASHIER_SESSION_DURATION_MS } from "@/lib/payments/sessionTiming";

const KASHIER_URL =
  process.env.KASHIER_MODE === "live"
    ? "https://api.kashier.io/v3/payment/sessions"
    : "https://test-api.kashier.io/v3/payment/sessions";
const ACTIVE_PAYMENT_STATUSES = [
  "created",
  "wallet_reserved",
  "kashier_pending",
] as const;
const ACTIVE_PAYMENT_STATUS_SET = new Set<string>(ACTIVE_PAYMENT_STATUSES);

async function tripPaymentCanContinue(
  tripId: Types.ObjectId,
  paymentId: Types.ObjectId,
  localReservationTxId?: string | null,
): Promise<boolean> {
  const [trip, payment] = await Promise.all([
    Trip.findOne({ _id: tripId, requestId: null })
      .select("status paymentStatus")
      .lean<{ status: string; paymentStatus: string } | null>(),
    Payment.findOne({ _id: paymentId, bookingId: tripId })
      .select("overallStatus walletStatus walletReservationTxId gatewayStatus")
      .lean<{
        overallStatus: string;
        walletStatus: string;
        walletReservationTxId?: Types.ObjectId | null;
        gatewayStatus: string;
      } | null>(),
  ]);

  if (
    payment &&
    trip &&
    canContinueStandaloneTripPayment({
      tripStatus: trip.status,
      tripPaymentStatus: trip.paymentStatus,
      paymentStatus: payment.overallStatus,
    })
  ) {
    return true;
  }
  if (!payment) {
    if (localReservationTxId) {
      await releaseReservation(localReservationTxId, {
        description: `Released — trip ${String(tripId)} is no longer payable.`,
        paymentId: String(paymentId),
        bookingId: String(tripId),
      });
    }
    return false;
  }

  let walletStatus = payment.walletStatus;
  let released = false;
  const reservationTxId =
    localReservationTxId ??
    (walletStatus === "reserved" && payment.walletReservationTxId
      ? String(payment.walletReservationTxId)
      : null);
  if (reservationTxId) {
    released = await releaseReservation(reservationTxId, {
      description: `Released — trip ${String(tripId)} is no longer payable.`,
      paymentId: String(paymentId),
      bookingId: String(tripId),
    });
    if (released) walletStatus = "released";
  }
  const setCancelled = {
    overallStatus: "cancelled",
    walletStatus,
    ...(payment.gatewayStatus === "pending"
      ? { gatewayStatus: "cancelled" }
      : {}),
  };
  if (ACTIVE_PAYMENT_STATUS_SET.has(payment.overallStatus)) {
    await Payment.updateOne(
      { _id: paymentId, overallStatus: { $in: ACTIVE_PAYMENT_STATUSES } },
      {
        $set: setCancelled,
        $push: { timeline: { event: "trip_not_payable" } },
      },
    );
  } else if (
    payment.overallStatus === "cancelled" &&
    released &&
    payment.walletStatus !== "released"
  ) {
    await Payment.updateOne(
      {
        _id: paymentId,
        overallStatus: "cancelled",
        walletStatus: payment.walletStatus,
      },
      { $set: { walletStatus: "released" } },
    );
  }
  return false;
}

function tripNotPayableResponse() {
  return NextResponse.json(
    { errorCode: "TRIP_NOT_PAYABLE", error: "This trip is no longer payable." },
    { status: 409 },
  );
}

function resolveBookingCurrencyCode(
  booking: { currencyCode?: string | null; regionCode?: string | null } | null,
): "EGP" | "SAR" | "AED" {
  const value = booking?.currencyCode;
  if (value === "EGP" || value === "SAR" || value === "AED") return value;
  return getCurrencyConfig(booking?.regionCode ?? DEFAULT_REGION).code;
}

/**
 * Create a mixed-payment session for a booking. Server computes the
 * wallet/gateway split — `useWallet` from the client is intent only, never an
 * amount. Wallet portion is RESERVED (not debited) until Kashier confirms.
 */
export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let bookingId: string;
  let useWallet = false;
  try {
    const body = await req.json();
    bookingId = body.bookingId;
    useWallet = Boolean(body.useWallet);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof bookingId !== "string" || !Types.ObjectId.isValid(bookingId))
    return NextResponse.json({ error: "Invalid bookingId" }, { status: 400 });

  await connectDB();

  const resolved = await resolvePayableBooking(bookingId, session.userId);

  if (
    !resolved ||
    (resolved.kind === "request" &&
      !["pending", "failed"].includes(resolved.paymentStatus))
  )
    return NextResponse.json(
      { error: "Request not found or already paid." },
      { status: 404 },
    );

  const booking = resolved.doc;
  const bookingObjectId = new Types.ObjectId(bookingId);

  if (resolved.kind === "trip" && !isStandaloneTripPayable(resolved)) {
    const error =
      resolved.status === "waiting_list"
        ? "This trip is waiting for admin approval and cannot be paid yet."
        : resolved.status === "rejected"
          ? "This trip was rejected and cannot be paid."
          : resolved.status === "cancelled" || resolved.status === "time_out"
            ? "This trip is no longer payable."
            : resolved.paymentStatus === "paid"
              ? "This trip has already been paid."
              : "This trip is not ready for payment.";
    return NextResponse.json(
      { errorCode: "TRIP_NOT_PAYABLE", error },
      { status: 409 },
    );
  }

  if (resolved.kind === "request" && resolved.status === "waiting_list") {
    return NextResponse.json(
      { error: "This shared-ride request is waiting for admin approval." },
      { status: 409 },
    );
  }

  if (resolved.kind === "request" && resolved.status === "rejected") {
    return NextResponse.json(
      { error: "This shared-ride request was rejected and cannot be paid." },
      { status: 409 },
    );
  }

  if (resolved.kind === "request") {
    const requestTrips = await Trip.find({ requestId: booking._id })
      .select("status priceEgp")
      .lean<{ status: string; priceEgp: number }[]>();
    const block = getRequestPaymentSessionBlock(
      {
        status: resolved.status,
        paymentStatus: resolved.paymentStatus,
        amountEgp: Number(resolved.amountEgp),
      },
      requestTrips,
    );
    if (block) {
      const message =
        block === "REQUEST_CANCELLED"
          ? "This Request has been cancelled and cannot be paid."
          : block === "REQUEST_NO_REMAINING_TRIPS"
            ? "This Request has no remaining trips to pay for."
            : block === "REQUEST_AMOUNT_MISMATCH"
              ? "The Request total changed. Refresh and try again."
              : "This Request is not ready for payment.";
      return NextResponse.json(
        { errorCode: block, error: message },
        { status: 409 },
      );
    }
  }

  if (resolved.kind === "request" && resolved.status === "approved") {
    const trips = await Trip.find({
      requestId: booking._id,
      status: { $ne: "cancelled" },
    })
      .select("date pickupTime")
      .lean<{ date: string; pickupTime: string }[]>();
    if (hasPastTrip(trips, getCairoNowParts())) {
      return NextResponse.json(
        {
          errorCode: "APPROVED_TRIP_IN_PAST",
          error:
            "This request has a trip whose pickup time has passed. Please book again.",
        },
        { status: 409 },
      );
    }
  }
  if (
    resolved.kind === "trip" &&
    isApprovedTripPickupPast(
      {
        status: resolved.status,
        date: booking.date,
        pickupTime: booking.pickupTime,
      },
      getCairoNowParts(),
    )
  ) {
    return NextResponse.json(
      {
        errorCode: "APPROVED_TRIP_IN_PAST",
        error:
          "This request has a trip whose pickup time has passed. Please book again.",
      },
      { status: 409 },
    );
  }

  let totalEgp = Number(resolved.amountEgp);
  if (!Number.isFinite(totalEgp) || totalEgp < 0)
    return NextResponse.json(
      { error: "Invalid booking amount." },
      { status: 400 },
    );

  // ── Server-side split (NEVER trust client) ──
  let walletAmount = 0;
  let availableWalletEgp = 0;
  if (useWallet) {
    const wallet = await getOrCreateWallet(session.userId);
    availableWalletEgp = Math.max(
      0,
      (wallet.balanceEgp ?? 0) - (wallet.reservedBalanceEgp ?? 0),
    );
    walletAmount = Math.min(totalEgp, availableWalletEgp);
  }
  if (resolved.kind === "trip") {
    const split = splitTripPaymentAmount(
      totalEgp,
      availableWalletEgp,
      useWallet,
    );
    totalEgp = split.totalEgp;
    walletAmount = split.walletAmountEgp;
  }
  const gatewayAmount = totalEgp - walletAmount;
  let appUrl: string | null = null;
  if (gatewayAmount > 0) {
    const validation = validatePaymentAppUrl(process.env.APP_URL, {
      nodeEnv: process.env.NODE_ENV,
      appEnv: process.env.APP_ENV,
      kashierMode: process.env.KASHIER_MODE,
    });
    if (!validation.valid) {
      console.error("Invalid APP_URL for Kashier session", {
        host: validation.host,
      });
      return NextResponse.json(
        {
          errorCode: "INVALID_APP_URL",
          error: "APP_URL must be an absolute public URL for payment checkout.",
        },
        { status: 500 },
      );
    }
    appUrl = validation.baseUrl;
  }

  // ── Create Payment aggregate ──
  // Guard against double-checkout races (two tabs, double-click): the unique
  // partial index on {bookingId, overallStatus:active} rejects a second
  // concurrent attempt instead of creating a parallel reservation/charge.
  let payment: InstanceType<typeof Payment> | undefined;
  let tripChangedDuringSessionCreation = false;
  const requestSessionState: {
    changed: boolean;
    block:
      | ReturnType<typeof getRequestPaymentSessionBlock>
      | "REQUEST_CHANGED"
      | null;
  } = { changed: false, block: null };
  try {
    const bookingCurrencyCode = resolveBookingCurrencyCode(
      booking as { currencyCode?: string | null; regionCode?: string | null },
    );
    const paymentData = {
      userId: new Types.ObjectId(session.userId),
      bookingId: booking._id,
      currencyCode: bookingCurrencyCode,
      totalEgp,
      walletAmountEgp: walletAmount,
      gatewayAmountEgp: gatewayAmount,
      walletStatus:
        resolved.kind === "trip"
          ? "none"
          : walletAmount > 0
            ? "reserved"
            : "none",
      gatewayStatus: gatewayAmount > 0 ? "pending" : "none",
      overallStatus: "created",
      timeline: [
        {
          event: "payment_created",
          detail: `Total ${totalEgp} EGP (wallet ${walletAmount}, gateway ${gatewayAmount})`,
        },
      ],
    };
    if (resolved.kind === "trip") {
      const dbSession = await mongoose.startSession();
      try {
        await dbSession.withTransaction(async () => {
          tripChangedDuringSessionCreation = false;
          const now = new Date();
          const paymentStatus = resolved.paymentStatus;
          const reset = await Trip.updateOne(
            {
              _id: bookingObjectId,
              requestId: null,
              status: { $in: ["pending_payment", "approved"] },
              paymentStatus: { $in: ["pending", "failed"] },
            },
            {
              $set: {
                updatedAt: now,
                ...(shouldResetFailedTripForRetry(
                  resolved.status,
                  paymentStatus,
                )
                  ? { paymentStatus: "pending" }
                  : {}),
              },
            },
            { session: dbSession },
          );
          if (reset.matchedCount !== 1) {
            tripChangedDuringSessionCreation = true;
            return;
          }
          [payment] = await Payment.create([paymentData], {
            session: dbSession,
          });
        });
      } finally {
        await dbSession.endSession();
      }
      if (tripChangedDuringSessionCreation) {
        return NextResponse.json(
          { error: "This trip changed while creating the payment session." },
          { status: 409 },
        );
      }
    } else {
      const dbSession = await mongoose.startSession();
      try {
        await dbSession.withTransaction(async () => {
          requestSessionState.changed = false;
          requestSessionState.block = null;
          const currentRequest = await Request.findOne({
            _id: bookingObjectId,
            userId: new Types.ObjectId(session.userId),
          })
            .select("status paymentStatus amountEgp")
            .session(dbSession)
            .lean<{
              status: string;
              paymentStatus: string;
              amountEgp: number;
            } | null>();
          if (!currentRequest) {
            requestSessionState.changed = true;
            return;
          }

          const currentTrips = await Trip.find({
            requestId: bookingObjectId,
          })
            .select("status priceEgp")
            .session(dbSession)
            .lean<{ status: string; priceEgp: number }[]>();
          requestSessionState.block = getRequestPaymentSessionBlock(
            currentRequest,
            currentTrips,
          );
          if (
            !requestSessionState.block &&
            currentRequest.amountEgp !== Number(resolved.amountEgp)
          ) {
            requestSessionState.block = "REQUEST_AMOUNT_MISMATCH";
          }
          if (requestSessionState.block) return;

          const requestLock = await Request.updateOne(
            {
              _id: bookingObjectId,
              userId: new Types.ObjectId(session.userId),
              status: currentRequest.status,
              paymentStatus: currentRequest.paymentStatus,
              amountEgp: currentRequest.amountEgp,
            },
            { $set: { updatedAt: new Date() } },
            { session: dbSession },
          );
          if (requestLock.matchedCount !== 1) {
            requestSessionState.changed = true;
            return;
          }
          [payment] = await Payment.create([paymentData], {
            session: dbSession,
          });
        });
      } finally {
        await dbSession.endSession();
      }
      if (requestSessionState.changed || requestSessionState.block) {
        const code = requestSessionState.changed
          ? "REQUEST_CHANGED"
          : requestSessionState.block;
        return NextResponse.json(
          {
            errorCode: code,
            error:
              code === "REQUEST_AMOUNT_MISMATCH"
                ? "The Request total changed. Refresh and try again."
                : "This Request changed while creating the payment session.",
          },
          { status: 409 },
        );
      }
    }
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      const existing = await Payment.findOne({
        bookingId: booking._id,
        overallStatus: {
          $in: ["created", "wallet_reserved", "kashier_pending"],
        },
      }).sort({ createdAt: -1 });
      return NextResponse.json(
        {
          error: "A payment is already in progress for this booking.",
          paymentId: existing ? String(existing._id) : null,
        },
        { status: 409 },
      );
    }
    throw err;
  }

  if (!payment) {
    throw new Error("Payment record was not created.");
  }

  if (
    resolved.kind === "trip" &&
    !(await tripPaymentCanContinue(bookingObjectId, payment._id))
  ) {
    return tripNotPayableResponse();
  }

  // ── Wallet reservation (if any) ──
  let reservationTxId: string | null = null;
  if (walletAmount > 0) {
    if (
      resolved.kind === "trip" &&
      !(await tripPaymentCanContinue(bookingObjectId, payment._id))
    ) {
      return tripNotPayableResponse();
    }
    const reserved = await reserveWallet(session.userId, walletAmount, {
      description: `Reserved for booking ${booking._id}`,
      paymentId: String(payment._id),
      bookingId: String(booking._id),
    });
    if (!reserved) {
      if (
        resolved.kind === "trip" &&
        !(await tripPaymentCanContinue(bookingObjectId, payment._id))
      ) {
        return tripNotPayableResponse();
      }
      await Payment.updateOne(
        resolved.kind === "trip"
          ? {
              _id: payment._id,
              overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
            }
          : { _id: payment._id },
        {
          $set: { overallStatus: "failed", walletStatus: "none" },
          $push: { timeline: { event: "wallet_reservation_failed" } },
        },
      );
      return NextResponse.json(
        {
          error: "Wallet reservation failed — insufficient available balance.",
        },
        { status: 402 },
      );
    }
    reservationTxId = reserved.transactionId;
    const reservationTransition = await Payment.updateOne(
      resolved.kind === "trip"
        ? { _id: payment._id, overallStatus: "created" }
        : { _id: payment._id },
      {
        $set: {
          walletReservationTxId: new Types.ObjectId(reservationTxId),
          overallStatus: "wallet_reserved",
          walletStatus: "reserved",
        },
        $push: {
          timeline: { event: "wallet_reserved", detail: `${walletAmount} EGP` },
        },
      },
    );
    if (resolved.kind === "trip" && reservationTransition.modifiedCount !== 1) {
      await releaseReservation(reservationTxId, {
        description: `Released — trip ${String(booking._id)} is no longer payable.`,
        paymentId: String(payment._id),
        bookingId: String(booking._id),
      });
      await tripPaymentCanContinue(bookingObjectId, payment._id);
      return tripNotPayableResponse();
    }
  }

  // ── Wallet-only fast path (no Kashier call) ──
  if (gatewayAmount === 0) {
    if (resolved.kind === "trip") {
      const settlement = await settleStandaloneTripPayment(
        String(booking._id),
        String(payment._id),
      );

      if (
        settlement === "already_paid" ||
        settlement === "blocked" ||
        settlement === "missing"
      ) {
        if (reservationTxId) {
          await releaseReservation(reservationTxId, {
            description: `Released — trip is no longer payable`,
            paymentId: String(payment._id),
            bookingId: String(booking._id),
          });
        }
        await Payment.updateOne(
          {
            _id: payment._id,
            overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
          },
          {
            $set: {
              overallStatus: "cancelled",
              walletStatus: walletAmount > 0 ? "released" : "none",
            },
            $push: { timeline: { event: "trip_not_payable" } },
          },
        );
        return NextResponse.json(
          {
            errorCode: "TRIP_NOT_PAYABLE",
            error: "This trip is no longer payable.",
          },
          { status: 409 },
        );
      }
      if (settlement === "capture_failed") {
        if (reservationTxId) {
          await releaseReservation(reservationTxId, {
            description: `Released — wallet capture failed`,
            paymentId: String(payment._id),
            bookingId: String(booking._id),
          });
        }
        await Payment.updateOne(
          {
            _id: payment._id,
            overallStatus: { $in: ["created", "wallet_reserved"] },
          },
          {
            $set: { overallStatus: "failed" },
            $push: { timeline: { event: "wallet_capture_failed" } },
          },
        );
        return NextResponse.json(
          { error: "Wallet capture failed." },
          { status: 500 },
        );
      }
      if (settlement === "settled") {
        await notifyAdminsOfPaidTrip(String(booking._id));
        await createNotification({
          userId: session.userId,
          type: "payment_paid",
          title: "Payment completed",
          body: "Your trip payment was successful.",
          data: {
            tripId: String(booking._id),
            linkUrl: `/my-trips/${booking._id}`,
            paymentId: String(payment._id),
          },
        });
      }

      return NextResponse.json({
        walletOnly: true,
        paymentId: String(payment._id),
        redirect: `/checkout/callback?bookingId=${bookingId}&paymentId=${payment._id}`,
      });
    }

    const settlement = await settleRequestPayment(String(booking._id), {
      paymentId: String(payment._id),
    });
    if (settlement === "capture_failed") {
      return NextResponse.json(
        { error: "Wallet capture failed; retry payment verification." },
        { status: 500 },
      );
    }
    if (settlement === "not_settled") {
      if (reservationTxId) {
        await releaseReservation(reservationTxId, {
          description: `Released — booking ${booking._id} was no longer payable.`,
          paymentId: String(payment._id),
          bookingId: String(booking._id),
        });
      }
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            overallStatus: "cancelled",
            walletStatus: walletAmount > 0 ? "released" : "none",
          },
          $push: { timeline: { event: "booking_not_payable" } },
        },
      );
      return NextResponse.json(
        { error: "Booking is no longer payable." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      walletOnly: true,
      paymentId: String(payment._id),
      redirect: `/checkout/callback?bookingId=${bookingId}&paymentId=${payment._id}`,
    });
  }

  // ── Mixed / card-only: create Kashier session ──
  if (
    !process.env.KASHIER_API_KEY ||
    !process.env.KASHIER_SECRET_KEY ||
    !process.env.KASHIER_MERCHANT_ID
  ) {
    if (reservationTxId) {
      await releaseReservation(reservationTxId, {
        description: `Released — gateway unavailable`,
        paymentId: String(payment._id),
        bookingId: String(booking._id),
      });
    }
    await Payment.updateOne(
      resolved.kind === "trip"
        ? {
            _id: payment._id,
            overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
          }
        : { _id: payment._id },
      {
        $set: {
          overallStatus: "failed",
          walletStatus: walletAmount > 0 ? "released" : "none",
          gatewayStatus: "failed",
        },
        $push: { timeline: { event: "kashier_credentials_missing" } },
      },
    );
    return NextResponse.json(
      { error: "Kashier credentials are not configured on the server." },
      { status: 500 },
    );
  }

  const expireAt = new Date(
    Date.now() + KASHIER_SESSION_DURATION_MS,
  ).toISOString();

  const bookingCurrencyCode = resolveBookingCurrencyCode(
    booking as { currencyCode?: string | null; regionCode?: string | null },
  );
  const kashierBody = {
    merchantOrderId: String(payment._id),
    merchantId: process.env.KASHIER_MERCHANT_ID!,
    amount:
      resolved.kind === "trip"
        ? formatKashierAmount(gatewayAmount)
        : String(gatewayAmount),
    currency: bookingCurrencyCode,
    paymentType: "credit",
    type: "one-time",
    maxFailureAttempts: 3,
    expireAt,
    display: "en",
    allowedMethods: "card,wallet",
    customer: { email: session.email, reference: String(session.userId) },
    merchantRedirect: `${appUrl}/checkout/callback?bookingId=${bookingId}&paymentId=${payment._id}`,
    serverWebhook: `${appUrl}/api/payments/webhook`,
  };

  if (
    resolved.kind === "trip" &&
    !(await tripPaymentCanContinue(
      bookingObjectId,
      payment._id,
      reservationTxId,
    ))
  ) {
    return tripNotPayableResponse();
  }

  let kashierRes: Response;
  try {
    kashierRes = await fetch(KASHIER_URL, {
      method: "POST",
      headers: {
        Authorization: process.env.KASHIER_SECRET_KEY!,
        "api-key": process.env.KASHIER_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(kashierBody),
    });
  } catch (err) {
    const cause = err instanceof Error ? err.cause : undefined;
    const causeCode =
      cause && typeof cause === "object" && "code" in cause
        ? cause.code
        : undefined;
    console.error("Kashier session request failed:", {
      name: err instanceof Error ? err.name : "UnknownError",
      causeCode: typeof causeCode === "string" ? causeCode : undefined,
    });
    if (reservationTxId) {
      await releaseReservation(reservationTxId, {
        description: `Released — gateway unreachable`,
        paymentId: String(payment._id),
        bookingId: String(booking._id),
      });
    }
    await Payment.updateOne(
      resolved.kind === "trip"
        ? {
            _id: payment._id,
            overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
          }
        : { _id: payment._id },
      {
        $set: {
          overallStatus: "failed",
          walletStatus: walletAmount > 0 ? "released" : "none",
          gatewayStatus: "failed",
        },
        $push: { timeline: { event: "kashier_unreachable" } },
      },
    );
    return NextResponse.json(
      { error: "Failed to reach payment gateway." },
      { status: 502 },
    );
  }

  const kashierText = await kashierRes.text();
  let kashierData: Record<string, unknown> | null = null;
  try {
    kashierData = JSON.parse(kashierText) as Record<string, unknown>;
  } catch {
    console.error("Kashier non-JSON response", kashierRes.status);
    if (reservationTxId) {
      await releaseReservation(reservationTxId, {
        description: `Released — gateway error`,
        paymentId: String(payment._id),
        bookingId: String(booking._id),
      });
    }
    if (resolved.kind === "trip") {
      await Payment.updateOne(
        {
          _id: payment._id,
          overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
        },
        {
          $set: {
            overallStatus: "failed",
            walletStatus: walletAmount > 0 ? "released" : "none",
            gatewayStatus: "failed",
          },
          $push: { timeline: { event: "kashier_invalid_response" } },
        },
      );
    }
    return NextResponse.json(
      { error: "Payment gateway returned non-JSON response" },
      { status: 502 },
    );
  }

  if (!kashierRes.ok || !kashierData?.sessionUrl) {
    console.error(
      "Kashier session error:",
      kashierRes.status,
      safeKashierErrorFields(kashierData ?? {}),
    );
    if (reservationTxId) {
      await releaseReservation(reservationTxId, {
        description: `Released — gateway rejected session`,
        paymentId: String(payment._id),
        bookingId: String(booking._id),
      });
    }
    await Payment.updateOne(
      resolved.kind === "trip"
        ? {
            _id: payment._id,
            overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
          }
        : { _id: payment._id },
      {
        $set: {
          overallStatus: "failed",
          walletStatus: walletAmount > 0 ? "released" : "none",
          gatewayStatus: "failed",
        },
        $push: { timeline: { event: "kashier_session_rejected" } },
      },
    );
    return NextResponse.json(
      { error: "Payment gateway rejected the request." },
      { status: 502 },
    );
  }

  const kashierSessionId = String(kashierData._id ?? "");
  const sessionTransition = await Payment.updateOne(
    resolved.kind === "trip"
      ? {
          _id: payment._id,
          overallStatus: { $in: ["created", "wallet_reserved"] },
        }
      : { _id: payment._id },
    {
      $set: {
        kashierSessionId,
        kashierOrderId: String(payment._id),
        overallStatus: "kashier_pending",
      },
      $push: {
        timeline: {
          event: "kashier_session_created",
          detail: `${gatewayAmount} EGP`,
        },
      },
    },
  );
  if (resolved.kind === "trip" && sessionTransition.modifiedCount !== 1) {
    if (reservationTxId) {
      await releaseReservation(reservationTxId, {
        description: `Released — trip ${String(booking._id)} is no longer payable.`,
        paymentId: String(payment._id),
        bookingId: String(booking._id),
      });
    }
    await tripPaymentCanContinue(bookingObjectId, payment._id);
    return tripNotPayableResponse();
  }

  // Keep booking-level Kashier hints for legacy readers.
  if (resolved.kind === "request") {
    await Request.findByIdAndUpdate(bookingId, {
      kashierSessionId,
      kashierOrderId: String(payment._id),
    });
  } else {
    await Trip.updateOne(
      {
        _id: bookingObjectId,
        requestId: null,
        status: { $in: ["pending_payment", "approved"] },
        paymentStatus: { $in: ["pending", "failed"] },
      },
      {
        $set: {
          kashierSessionId,
          kashierOrderId: String(payment._id),
        },
      },
    );
  }

  const representativeTripId =
    resolved.kind === "trip"
      ? String(booking._id)
      : booking.tripIds?.[0]
        ? String(booking.tripIds[0])
        : String(
            (
              await Trip.findOne({ requestId: booking._id })
                .sort({ date: 1, cycleIndex: 1 })
                .select("_id")
                .lean<{ _id: Types.ObjectId } | null>()
            )?._id ?? "",
          );

  await createNotification({
    userId: session.userId,
    type: "payment_required",
    title: "Complete your payment",
    body: "Your booking is waiting for payment. Continue checkout to secure your trip.",
    data: {
      bookingId,
      paymentId: String(payment._id),
      ...(representativeTripId
        ? {
            tripId: representativeTripId,
            linkUrl: `/my-trips/${representativeTripId}`,
          }
        : { linkUrl: "/my-trips" }),
    },
  });

  return NextResponse.json({
    sessionUrl: kashierData.sessionUrl,
    paymentId: String(payment._id),
    walletAmountEgp: walletAmount,
    gatewayAmountEgp: gatewayAmount,
  });
}
