import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { Payment } from "@/models/Payment";
import {
  getOrCreateWallet,
  reserveWallet,
  captureReservation,
  releaseReservation,
} from "@/lib/wallet/wallet";
import { createNotification } from "@/lib/notifications/createNotification";
import { Types } from "mongoose";
import { validateMutationRequest } from "@/lib/security/request";

const KASHIER_URL =
  process.env.KASHIER_MODE === "live"
    ? "https://api.kashier.io/v3/payment/sessions"
    : "https://test-api.kashier.io/v3/payment/sessions";

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

  const booking = await Request.findOne({
    _id: bookingId,
    userId: new Types.ObjectId(session.userId),
    paymentStatus: { $in: ["pending", "failed"] },
  });

  if (!booking)
    return NextResponse.json(
      { error: "Request not found or already paid." },
      { status: 404 },
    );

  const totalEgp = Number(booking.amountEgp);
  if (!Number.isFinite(totalEgp) || totalEgp <= 0)
    return NextResponse.json(
      { error: "Invalid booking amount." },
      { status: 400 },
    );

  // ── Server-side split (NEVER trust client) ──
  let walletAmount = 0;
  if (useWallet) {
    const wallet = await getOrCreateWallet(session.userId);
    const available = Math.max(
      0,
      (wallet.balanceEgp ?? 0) - (wallet.reservedBalanceEgp ?? 0),
    );
    walletAmount = Math.min(totalEgp, available);
  }
  const gatewayAmount = totalEgp - walletAmount;

  // ── Create Payment aggregate ──
  // Guard against double-checkout races (two tabs, double-click): the unique
  // partial index on {bookingId, overallStatus:active} rejects a second
  // concurrent attempt instead of creating a parallel reservation/charge.
  let payment;
  try {
    payment = await Payment.create({
      userId: new Types.ObjectId(session.userId),
      bookingId: booking._id,
      totalEgp,
      walletAmountEgp: walletAmount,
      gatewayAmountEgp: gatewayAmount,
      walletStatus: walletAmount > 0 ? "reserved" : "none",
      gatewayStatus: gatewayAmount > 0 ? "pending" : "none",
      overallStatus: "created",
      timeline: [
        {
          event: "payment_created",
          detail: `Total ${totalEgp} EGP (wallet ${walletAmount}, gateway ${gatewayAmount})`,
        },
      ],
    });
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      const existing = await Payment.findOne({
        bookingId: booking._id,
        overallStatus: { $in: ["created", "wallet_reserved", "kashier_pending"] },
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

  // ── Wallet reservation (if any) ──
  let reservationTxId: string | null = null;
  if (walletAmount > 0) {
    const reserved = await reserveWallet(session.userId, walletAmount, {
      description: `Reserved for booking ${booking._id}`,
      paymentId: String(payment._id),
      bookingId: String(booking._id),
    });
    if (!reserved) {
      await Payment.updateOne(
        { _id: payment._id },
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
    await Payment.updateOne(
      { _id: payment._id },
      {
        $set: {
          walletReservationTxId: new Types.ObjectId(reservationTxId),
          overallStatus: "wallet_reserved",
        },
        $push: {
          timeline: { event: "wallet_reserved", detail: `${walletAmount} EGP` },
        },
      },
    );
  }

  // ── Wallet-only fast path (no Kashier call) ──
  if (gatewayAmount === 0) {
    const captured = reservationTxId
      ? await captureReservation(reservationTxId, {
          description: `Payment for booking ${booking._id}`,
          paymentId: String(payment._id),
          bookingId: String(booking._id),
        })
      : null;

    if (walletAmount > 0 && captured === null) {
      await Payment.updateOne(
        { _id: payment._id },
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

    // Settle booking — race-safe conditional update.
    const settled = await Request.findOneAndUpdate(
      { _id: booking._id, paymentStatus: { $in: ["pending", "failed"] } },
      { paymentStatus: "paid", status: "submitted", paidAt: new Date() },
    );
    if (!settled) {
      // Lost race — release/refund what we captured.
      if (walletAmount > 0) {
        // Already captured; issue a refund credit.
        const { creditWallet } = await import("@/lib/wallet/wallet");
        await creditWallet(session.userId, walletAmount, {
          description: `Refund — booking ${booking._id} already paid`,
          type: "refund",
          paymentId: String(payment._id),
          bookingId: String(booking._id),
        });
      }
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: { overallStatus: "cancelled", walletStatus: "refunded" },
          $push: { timeline: { event: "booking_already_paid_refunded" } },
        },
      );
      return NextResponse.json(
        { error: "Booking was already paid. Your wallet was not charged." },
        { status: 409 },
      );
    }

    await Trip.updateMany(
      { requestId: booking._id },
      { paymentStatus: "paid", status: "submitted" },
    );

    await Payment.updateOne(
      { _id: payment._id },
      {
        $set: {
          walletStatus: "captured",
          overallStatus: "paid",
          paidAt: new Date(),
        },
        $push: {
          timeline: [{ event: "wallet_captured" }, { event: "booking_paid" }],
        },
      },
    );

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
      { _id: payment._id },
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

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json(
      { error: "APP_URL is not configured on the server." },
      { status: 500 },
    );
  }
  const expireAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const kashierBody = {
    merchantOrderId: String(payment._id),
    merchantId: process.env.KASHIER_MERCHANT_ID!,
    amount: String(gatewayAmount),
    currency: "EGP",
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
    console.error("Kashier fetch error:", err);
    if (reservationTxId) {
      await releaseReservation(reservationTxId, {
        description: `Released — gateway unreachable`,
        paymentId: String(payment._id),
        bookingId: String(booking._id),
      });
    }
    await Payment.updateOne(
      { _id: payment._id },
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
    console.error(
      "Kashier non-JSON response",
      kashierRes.status,
      kashierText.substring(0, 200),
    );
    if (reservationTxId) {
      await releaseReservation(reservationTxId, {
        description: `Released — gateway error`,
        paymentId: String(payment._id),
        bookingId: String(booking._id),
      });
    }
    return NextResponse.json(
      { error: "Payment gateway returned non-JSON response" },
      { status: 502 },
    );
  }

  if (!kashierRes.ok || !kashierData?.sessionUrl) {
    console.error("Kashier session error:", kashierRes.status, kashierData);
    if (reservationTxId) {
      await releaseReservation(reservationTxId, {
        description: `Released — gateway rejected session`,
        paymentId: String(payment._id),
        bookingId: String(booking._id),
      });
    }
    await Payment.updateOne(
      { _id: payment._id },
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
  await Payment.updateOne(
    { _id: payment._id },
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

  // Keep booking-level Kashier hints for legacy readers.
  await Request.findByIdAndUpdate(bookingId, {
    kashierSessionId,
    kashierOrderId: String(payment._id),
  });

  await createNotification({
    userId: session.userId,
    type: "payment_required",
    title: "Complete your payment",
    body: "Your booking is waiting for payment. Continue checkout to secure your trip.",
    data: { bookingId, paymentId: String(payment._id) },
  });

  return NextResponse.json({
    sessionUrl: kashierData.sessionUrl,
    paymentId: String(payment._id),
    walletAmountEgp: walletAmount,
    gatewayAmountEgp: gatewayAmount,
  });
}
