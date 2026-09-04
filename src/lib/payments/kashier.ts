import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { Payment } from "@/models/Payment";
import { WalletTransaction } from "@/models/WalletTransaction";
import {
  creditWallet,
  captureReservation,
  releaseReservation,
} from "@/lib/wallet/wallet";
import { Types } from "mongoose";

const BASE =
  process.env.KASHIER_MODE === "live"
    ? "https://api.kashier.io"
    : "https://test-api.kashier.io";

type Settled = "pending" | "paid" | "failed";

/** Query Kashier for a session's payment outcome. Returns paid/failed/pending. */
async function queryKashierStatus(
  sessionId: string,
): Promise<"paid" | "failed" | "pending"> {
  if (!process.env.KASHIER_SECRET_KEY) return "pending";

  const url = `${BASE}/v3/payment/sessions/${encodeURIComponent(
    sessionId,
  )}/payment`;

  let data: Record<string, unknown> | null = null;
  try {
    const res = await fetch(url, {
      headers: { Authorization: process.env.KASHIER_SECRET_KEY },
      cache: "no-store",
    });
    const json = (await res.json()) as Record<string, unknown>;
    data = (json.data ?? json.response ?? json) as Record<string, unknown>;
  } catch {
    return "pending";
  }

  const status = String(data?.status ?? "").toUpperCase();
  if (["SUCCESS", "CAPTURED", "PAID"].includes(status)) return "paid";
  if (["FAILED", "DECLINED", "ERROR", "EXPIRED"].includes(status))
    return "failed";
  return "pending";
}

/**
 * Query Kashier for the real payment status of a booking's session and settle
 * the booking in the DB. SOURCE OF TRUTH — do not rely on the webhook alone
 * (webhooks can fail or be delayed). Safe to call repeatedly (idempotent).
 */
export async function verifyAndSettleBooking(
  bookingId: string,
  userId?: string,
): Promise<Settled> {
  if (!Types.ObjectId.isValid(bookingId)) return "pending";

  await connectDB();

  const query: Record<string, unknown> = { _id: bookingId };
  if (userId) query.userId = new Types.ObjectId(userId);

  const booking = await Request.findOne(query);
  if (!booking) return "pending";

  if (booking.paymentStatus === "paid") return "paid";
  if (booking.paymentStatus === "failed") return "failed";

  // Prefer the newest Payment (mixed-payment aware) if one exists.
  const payment = await Payment.findOne({
    bookingId: booking._id,
    overallStatus: { $in: ["created", "wallet_reserved", "kashier_pending"] },
  }).sort({ createdAt: -1 });

  if (payment) {
    // No gateway leg — capture wallet and settle.
    if (payment.gatewayAmountEgp === 0) {
      const settled = await Request.findOneAndUpdate(
        { _id: booking._id, paymentStatus: { $in: ["pending", "failed"] } },
        { paymentStatus: "paid", status: "submitted", paidAt: new Date() },
      );

      if (!settled) {
        if (
          payment.walletReservationTxId &&
          payment.walletStatus === "reserved"
        ) {
          await releaseReservation(String(payment.walletReservationTxId), {
            description: `Released — booking already settled (duplicate payment ${payment._id})`,
            paymentId: String(payment._id),
            bookingId: String(payment.bookingId),
          });
        }
        await Payment.updateOne(
          { _id: payment._id },
          {
            $set: { overallStatus: "cancelled", walletStatus: "released" },
            $push: { timeline: { event: "duplicate_settlement_prevented" } },
          },
        );
        return booking.paymentStatus === "paid" ? "paid" : "failed";
      }

      if (
        payment.walletReservationTxId &&
        payment.walletStatus === "reserved"
      ) {
        const captured = await captureReservation(
          String(payment.walletReservationTxId),
          {
            description: `Payment for booking ${payment.bookingId}`,
            paymentId: String(payment._id),
            bookingId: String(payment.bookingId),
          },
        );
        if (captured === null) return "pending";
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
          $push: { timeline: { event: "verify_settled_paid" } },
        },
      );
      return "paid";
    }

    if (!payment.kashierSessionId) return "pending";
    const outcome = await queryKashierStatus(payment.kashierSessionId);

    if (outcome === "paid") {
      // Claim booking BEFORE capturing money — same invariant as the webhook
      // path: never take funds for a Payment that lost the settlement race.
      const settled = await Request.findOneAndUpdate(
        { _id: booking._id, paymentStatus: { $in: ["pending", "failed"] } },
        { paymentStatus: "paid", status: "submitted", paidAt: new Date() },
      );

      if (!settled) {
        if (
          payment.walletReservationTxId &&
          payment.walletStatus === "reserved"
        ) {
          await releaseReservation(String(payment.walletReservationTxId), {
            description: `Released — booking already settled (duplicate payment ${payment._id})`,
            paymentId: String(payment._id),
            bookingId: String(payment.bookingId),
          });
        }
        let gatewayRefunded = false;
        if (payment.gatewayAmountEgp > 0 && payment.kashierOrderId) {
          const refund = await refundKashierPayment(
            payment.kashierOrderId,
            payment.gatewayAmountEgp,
            "Duplicate payment — booking already settled",
          );
          gatewayRefunded = refund !== null;
        }
        await Payment.updateOne(
          { _id: payment._id },
          {
            $set: {
              overallStatus: "cancelled",
              walletStatus: payment.walletAmountEgp > 0 ? "released" : "none",
              gatewayStatus:
                payment.gatewayAmountEgp > 0
                  ? gatewayRefunded
                    ? "refunded"
                    : "success"
                  : "none",
            },
            $push: {
              timeline: {
                event: "duplicate_settlement_prevented",
                detail: gatewayRefunded
                  ? "wallet released, gateway refunded"
                  : payment.gatewayAmountEgp > 0
                    ? "wallet released, gateway refund FAILED — manual action required"
                    : "wallet released",
              },
            },
          },
        );
        return booking.paymentStatus === "paid" ? "paid" : "failed";
      }

      if (
        payment.walletReservationTxId &&
        payment.walletStatus === "reserved"
      ) {
        const captured = await captureReservation(
          String(payment.walletReservationTxId),
          {
            description: `Payment for booking ${payment.bookingId}`,
            paymentId: String(payment._id),
            bookingId: String(payment.bookingId),
          },
        );
        if (captured === null) return "pending";
      }
      await Trip.updateMany(
        { requestId: settled._id },
        { paymentStatus: "paid", status: "submitted" },
      );
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            gatewayStatus: "success",
            walletStatus:
              payment.walletAmountEgp > 0 ? "captured" : payment.walletStatus,
            overallStatus: "paid",
            paidAt: new Date(),
          },
          $push: { timeline: { event: "verify_settled_paid" } },
        },
      );
      if (payment.gatewayAmountEgp > 0) {
        await WalletTransaction.updateOne(
          { paymentId: payment._id, type: "kashier_payment" },
          {
            $setOnInsert: {
              userId: payment.userId,
              type: "kashier_payment",
              amountEgp: payment.gatewayAmountEgp,
              status: "completed",
              description: `Card payment via Kashier for booking ${payment.bookingId}`,
              paymentId: payment._id,
              bookingId: payment.bookingId,
              kashierSessionId: payment.kashierSessionId ?? undefined,
              kashierOrderId: payment.kashierOrderId ?? undefined,
            },
          },
          { upsert: true },
        );
      }
      return "paid";
    }
    if (outcome === "failed") {
      if (
        payment.walletReservationTxId &&
        payment.walletStatus === "reserved"
      ) {
        await releaseReservation(String(payment.walletReservationTxId), {
          description: `Released — verify observed Kashier failure`,
          paymentId: String(payment._id),
          bookingId: String(payment.bookingId),
        });
      }
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            gatewayStatus: "failed",
            walletStatus:
              payment.walletAmountEgp > 0 ? "released" : payment.walletStatus,
            overallStatus: "failed",
          },
          $push: { timeline: { event: "verify_settled_failed" } },
        },
      );
      await Request.findOneAndUpdate(
        { _id: bookingId, paymentStatus: "pending" },
        { paymentStatus: "failed" },
      );
      return "failed";
    }
    return "pending";
  }

  // ── Legacy: no Payment doc; fall back to booking-level session ──
  if (!booking.kashierSessionId) return "pending";

  const outcome = await queryKashierStatus(booking.kashierSessionId);

  if (outcome === "paid") {
    const settled = await Request.findOneAndUpdate(
      { _id: bookingId, paymentStatus: { $in: ["pending", "failed"] } },
      { paymentStatus: "paid", status: "submitted", paidAt: new Date() },
    );
    if (settled) {
      await Trip.updateMany(
        { requestId: settled._id },
        { paymentStatus: "paid", status: "submitted" },
      );
    }
    return "paid";
  }
  if (outcome === "failed") {
    await Request.findOneAndUpdate(
      { _id: bookingId, paymentStatus: "pending" },
      { paymentStatus: "failed" },
    );
    return "failed";
  }
  return "pending";
}

/**
 * Settle a pending wallet top-up against Kashier and credit the wallet on
 * success. Idempotent: the conditional status filter ensures the credit runs
 * at most once even if webhook + redirect both fire.
 */
export async function verifyAndSettleTopup(
  transactionId: string,
  userId?: string,
): Promise<Settled> {
  if (!Types.ObjectId.isValid(transactionId)) return "pending";

  await connectDB();

  const query: Record<string, unknown> = { _id: transactionId, type: "topup" };
  if (userId) query.userId = new Types.ObjectId(userId);

  const tx = await WalletTransaction.findOne(query);
  if (!tx) return "pending";

  if (tx.status === "completed") return "paid";
  if (tx.status === "failed") return "failed";
  if (!tx.kashierSessionId) return "pending";

  const outcome = await queryKashierStatus(tx.kashierSessionId);

  if (outcome === "paid") {
    await creditWallet(String(tx.userId), tx.amountEgp, {
      description: tx.description,
      transactionId: String(tx._id),
    });
    return "paid";
  }
  if (outcome === "failed") {
    await WalletTransaction.findOneAndUpdate(
      { _id: tx._id, status: "pending" },
      { status: "failed" },
    );
    return "failed";
  }
  return "pending";
}

/**
 * Refund a portion (or all) of a paid Kashier order. Returns the refund id on
 * success; null on failure. Real behavior depends on merchant support — if the
 * account cannot programmatically refund, the caller should record a manual
 * accountant task instead.
 */
export async function refundKashierPayment(
  orderId: string,
  amountEgp: number,
  reason?: string,
): Promise<{ refundId: string } | null> {
  if (!process.env.KASHIER_SECRET_KEY) return null;
  const url = `${BASE}/v3/orders/${encodeURIComponent(orderId)}/refunds`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: process.env.KASHIER_SECRET_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: String(amountEgp),
        reason: reason ?? "Refund",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const refundId =
      (data.refundId as string) ||
      (data._id as string) ||
      ((data.data as Record<string, unknown> | undefined)?._id as string);
    if (!refundId) return null;
    return { refundId };
  } catch {
    return null;
  }
}

/**
 * Reconcile every still-pending top-up for a user against Kashier. Self-heals
 * cases where the redirect AND webhook both failed to settle a paid top-up.
 * Returns how many were newly credited.
 */
export async function reconcilePendingTopups(userId: string): Promise<number> {
  await connectDB();

  const pending = await WalletTransaction.find({
    userId: new Types.ObjectId(userId),
    type: "topup",
    status: "pending",
    kashierSessionId: { $exists: true, $ne: "" },
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>();

  let credited = 0;
  for (const t of pending) {
    const outcome = await verifyAndSettleTopup(String(t._id), userId);
    if (outcome === "paid") credited += 1;
  }
  return credited;
}

/**
 * Release wallet reservations for the user's in-flight payments that have
 * been stuck in `wallet_reserved` / `kashier_pending` for longer than
 * `maxAgeMinutes`. Verifies against Kashier before releasing so a genuinely
 * paid session is still captured. Returns the count of reservations released.
 */
export async function reconcileStaleReservations(
  userId: string,
  maxAgeMinutes = 30,
): Promise<{ released: number; settled: number }> {
  await connectDB();

  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const stale = await Payment.find({
    userId: new Types.ObjectId(userId),
    overallStatus: { $in: ["wallet_reserved", "kashier_pending"] },
    createdAt: { $lt: cutoff },
  }).select("_id bookingId");

  let released = 0;
  let settled = 0;
  for (const p of stale) {
    const outcome = await verifyAndSettleBooking(String(p.bookingId), userId);
    if (outcome === "paid") settled += 1;
    else if (outcome === "failed") released += 1;
  }
  return { released, settled };
}
