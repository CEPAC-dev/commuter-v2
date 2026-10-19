import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import {
  notifyAdminsOfLateTripPayment,
  notifyAdminsOfPaidTrip,
} from "@/lib/notifications/adminActivity";
import { createNotification } from "@/lib/notifications/createNotification";
import { Payment } from "@/models/Payment";
import { WalletTransaction } from "@/models/WalletTransaction";
import { creditWallet, releaseReservation } from "@/lib/wallet/wallet";
import { isSettlementBlockedStatus } from "@/lib/pendingRequestHardening";
import { Types } from "mongoose";
import {
  isTripSettlementBlocked,
  resolvePayableBooking,
} from "@/lib/payments/resolveBooking";
import {
  failStandaloneTripPayment,
  settleStandaloneTripPayment,
} from "@/lib/payments/standaloneTripSettlement";
import { settleRequestPayment } from "@/lib/payments/requestSettlement";
import { handlePaidRequestPayment } from "@/lib/payments/requestPaymentRecovery";

const BASE =
  process.env.KASHIER_MODE === "live"
    ? "https://api.kashier.io"
    : "https://test-api.kashier.io";
const REFUND_BASE =
  process.env.KASHIER_MODE === "live"
    ? "https://fep.kashier.io"
    : "https://test-fep.kashier.io";

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
  paymentId?: string,
): Promise<Settled> {
  if (!Types.ObjectId.isValid(bookingId)) return "pending";

  await connectDB();

  const resolved = await resolvePayableBooking(bookingId, userId);
  if (!resolved) return "pending";
  if (resolved.kind === "trip") {
    return verifyAndSettleStandaloneTrip(resolved.doc, paymentId);
  }
  const booking = resolved.doc;

  if (booking.paymentStatus === "paid" && !paymentId) return "paid";
  if (booking.paymentStatus === "failed" && !paymentId) return "failed";
  if (isSettlementBlockedStatus(booking.status) && !paymentId) {
    console.warn(
      `[Payment] Refusing settlement for blocked booking ${String(booking._id)} (${booking.status})`,
    );
    return "pending";
  }

  // Prefer the newest Payment (mixed-payment aware) if one exists.
  const payment = paymentId
    ? await Payment.findOne({ _id: paymentId, bookingId: booking._id })
    : await Payment.findOne({
        bookingId: booking._id,
        overallStatus: {
          $in: ["created", "wallet_reserved", "kashier_pending"],
        },
      }).sort({ createdAt: -1 });

  if (payment) {
    // No gateway leg — capture wallet and settle.
    if (payment.gatewayAmountEgp === 0) {
      const settlement = await settleRequestPayment(String(booking._id), {
        paymentId: String(payment._id),
      });
      return settlement === "settled" || settlement === "already_settled"
        ? "paid"
        : "pending";
    }

    if (!payment.kashierSessionId) return "pending";
    const outcome = await queryKashierStatus(payment.kashierSessionId);

    if (outcome === "paid") {
      const recovery = await handlePaidRequestPayment({
        paymentId: String(payment._id),
      });
      return recovery === "settled" ||
        recovery === "settled_with_mismatch" ||
        recovery === "already_processed"
        ? "paid"
        : "pending";
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
    const settlement = await settleRequestPayment(bookingId);
    return settlement === "settled" || settlement === "already_settled"
      ? "paid"
      : "pending";
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

async function verifyAndSettleStandaloneTrip(
  trip: ReturnType<typeof Trip.hydrate>,
  paymentId?: string,
): Promise<Settled> {
  if (paymentId && !Types.ObjectId.isValid(paymentId)) return "pending";
  if (
    trip.paymentStatus !== "pending" &&
    trip.paymentStatus !== "failed" &&
    trip.paymentStatus !== "paid"
  )
    return "pending";
  const paymentQuery = paymentId
    ? Payment.findOne({ _id: paymentId, bookingId: trip._id })
    : Payment.findOne({
        bookingId: trip._id,
        overallStatus: {
          $in: ["created", "wallet_reserved", "kashier_pending"],
        },
      }).sort({ createdAt: -1 });
  const payment = await paymentQuery;

  if (isTripSettlementBlocked(trip.status)) {
    console.warn(
      `[Payment] Refusing settlement for blocked trip ${String(trip._id)} (${trip.status})`,
    );
    if (payment?.gatewayAmountEgp && payment.kashierSessionId) {
      const gatewayOutcome = await queryKashierStatus(payment.kashierSessionId);
      if (gatewayOutcome === "paid") {
        const blockedPaymentDetails = {
          tripId: String(trip._id),
          paymentId: String(payment._id),
          tripStatus: trip.status,
        };
        console.warn(
          "[Payment] Callback found a gateway charge for a blocked Trip",
          blockedPaymentDetails,
        );
        await Payment.updateOne(
          { _id: payment._id },
          {
            $push: {
              timeline: {
                event: "blocked_trip_payment_callback",
                detail: `Trip ${String(trip._id)} is ${trip.status}.`,
                actor: "kashier",
                meta: blockedPaymentDetails,
              },
            },
          },
        );
        await notifyAdminsOfLateTripPayment(
          String(payment._id),
          String(trip._id),
        );
      }
    }
    return "pending";
  }

  if (!payment) {
    if (trip.paymentStatus === "paid") return "paid";
    if (!trip.kashierSessionId) return "pending";
    const outcome = await queryKashierStatus(trip.kashierSessionId);
    if (outcome === "failed") return "failed";
    return "pending";
  }

  if (payment.gatewayAmountEgp === 0) {
    const outcome = await settleStandaloneTripPayment(
      String(trip._id),
      String(payment._id),
    );
    if (outcome === "settled") {
      await notifyAdminsOfPaidTrip(String(trip._id));
      await createNotification({
        userId: String(trip.userId),
        type: "payment_paid",
        title: "Payment completed",
        body: "Your trip payment was successful.",
        data: {
          tripId: String(trip._id),
          linkUrl: `/my-trips/${trip._id}`,
          paymentId: String(payment._id),
        },
      });
    }
    return outcome === "settled" ||
      outcome === "already_paid" ||
      trip.paymentStatus === "paid"
      ? "paid"
      : "pending";
  }

  if (!payment.kashierSessionId) return "pending";
  const outcome = await queryKashierStatus(payment.kashierSessionId);
  if (outcome === "paid") {
    const settlement = await settleStandaloneTripPayment(
      String(trip._id),
      String(payment._id),
    );
    if (settlement === "settled") {
      await notifyAdminsOfPaidTrip(String(trip._id));
      await createNotification({
        userId: String(trip.userId),
        type: "payment_paid",
        title: "Payment completed",
        body: "Your trip payment was successful.",
        data: {
          tripId: String(trip._id),
          linkUrl: `/my-trips/${trip._id}`,
          paymentId: String(payment._id),
        },
      });
    }
    return settlement === "settled" ||
      settlement === "already_paid" ||
      trip.paymentStatus === "paid"
      ? "paid"
      : "pending";
  }
  if (outcome === "failed") {
    const failure = await failStandaloneTripPayment(
      String(trip._id),
      String(payment._id),
      "callback_status_failed",
    );
    return trip.paymentStatus === "paid"
      ? "paid"
      : failure === "failed"
        ? "failed"
        : "pending";
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
): Promise<
  | { status: "succeeded"; refundId: string | null }
  | { status: "failed" }
  | { status: "unknown" }
> {
  if (!process.env.KASHIER_SECRET_KEY) return { status: "failed" };
  const url = `${REFUND_BASE}/v3/orders/${encodeURIComponent(orderId)}`;
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: process.env.KASHIER_SECRET_KEY,
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiOperation: "REFUND",
        reason: reason ?? "Refund",
        transaction: { amount: amountEgp },
      }),
    });
    const data = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!res.ok) {
      console.error("Kashier refund error", {
        status: res.status,
        orderId,
        amountEgp,
        message: data?.message,
      });
      return res.status < 500 ? { status: "failed" } : { status: "unknown" };
    }
    const response = data?.response as Record<string, unknown> | undefined;
    const nestedData = data?.data as Record<string, unknown> | undefined;
    const responseData = response?.data as Record<string, unknown> | undefined;
    const statuses = [
      data?.status,
      response?.status,
      nestedData?.status,
      responseData?.status,
    ].map((value) => String(value ?? "").toUpperCase());
    const status =
      statuses
        .filter(Boolean)
        .find((value) => ["SUCCESS", "REFUNDED"].includes(value)) ??
      statuses
        .map((value) => String(value ?? "").toUpperCase())
        .find((value) =>
          ["FAILED", "DECLINED", "ERROR", "REJECTED"].includes(value),
        );
    if (["FAILED", "DECLINED", "ERROR", "REJECTED"].includes(status ?? ""))
      return { status: "failed" };
    if (status !== "SUCCESS" && status !== "REFUNDED")
      return { status: "unknown" };

    const records = [data, response, nestedData, responseData].filter(
      (value): value is Record<string, unknown> => Boolean(value),
    );
    const id = records
      .map(
        (record) =>
          record.transactionId ?? record.refundId ?? record._id ?? record.id,
      )
      .find((value) => typeof value === "string" || typeof value === "number");
    return { status: "succeeded", refundId: id ? String(id) : null };
  } catch {
    return { status: "unknown" };
  }
}

export type KashierRefundLookup =
  | {
      status: "found";
      transactionStatus: "approved" | "failed" | "unknown";
      amountEgp: number | null;
      merchantOrderId: string;
      transactionId: string;
      date: Date | null;
    }
  | { status: "not_found" }
  | { status: "unavailable" };

export type KashierRefundOrderLookup =
  | {
      status: "found";
      transactions: Extract<KashierRefundLookup, { status: "found" }>[];
    }
  | { status: "not_found" }
  | { status: "unavailable" };

function parseKashierRefundTransaction(
  entry: unknown,
  expectedMerchantOrderId: string,
): Extract<KashierRefundLookup, { status: "found" }> | null {
  if (!entry || typeof entry !== "object") return null;
  const transaction = entry as Record<string, unknown>;
  const merchantOrderId = String(transaction.merchantOrderId ?? "");
  const transactionId = String(transaction.transactionId ?? "");
  if (
    !transactionId ||
    merchantOrderId !== expectedMerchantOrderId ||
    String(transaction.type ?? "").toUpperCase() !== "REFUND"
  )
    return null;

  const rawAmount =
    transaction.totalAuthorizedAmount ??
    transaction.amount ??
    transaction.transactionAmount;
  const parsedAmount = rawAmount == null ? Number.NaN : Number(rawAmount);
  const rawDate =
    transaction.dateToFilter ?? transaction.date ?? transaction.createdAt;
  const parsedDate = rawDate ? new Date(String(rawDate)) : null;
  const status = String(transaction.status ?? "").toLowerCase();

  return {
    status: "found",
    transactionStatus:
      status === "approved"
        ? "approved"
        : status === "rejected"
          ? "failed"
          : "unknown",
    amountEgp: Number.isFinite(parsedAmount) ? parsedAmount : null,
    merchantOrderId,
    transactionId,
    date:
      parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate : null,
  };
}

async function searchKashierRefundTransactions(
  searchTerm: string,
  expectedMerchantOrderId: string,
): Promise<KashierRefundOrderLookup> {
  if (!process.env.KASHIER_SECRET_KEY) return { status: "unavailable" };

  const url = new URL(`${BASE}/v2/aggregator/transactions`);
  url.searchParams.set("search", searchTerm);
  url.searchParams.set("type", "refund");
  url.searchParams.set("limit", "100");
  try {
    const res = await fetch(url, {
      headers: { Authorization: process.env.KASHIER_SECRET_KEY },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("Kashier refund lookup failed", {
        status: res.status,
        searchTerm,
      });
      return { status: "unavailable" };
    }

    const payload = (await res.json()) as Record<string, unknown>;
    const records = Array.isArray(payload.body)
      ? payload.body
      : Array.isArray(payload.data)
        ? payload.data
        : null;
    if (!records) return { status: "unavailable" };

    const transactions = records
      .map((entry) =>
        parseKashierRefundTransaction(entry, expectedMerchantOrderId),
      )
      .filter(
        (entry): entry is Extract<KashierRefundLookup, { status: "found" }> =>
          entry !== null,
      );
    return transactions.length
      ? { status: "found", transactions }
      : { status: "not_found" };
  } catch (error) {
    console.error("Kashier refund lookup request failed", {
      searchTerm,
      error,
    });
    return { status: "unavailable" };
  }
}

/** Read Kashier's transaction record by reference before allowing a retry. */
export async function queryKashierRefundTransaction(
  transactionId: string,
  expectedMerchantOrderId: string,
): Promise<KashierRefundLookup> {
  if (!process.env.KASHIER_SECRET_KEY) return { status: "unavailable" };

  const url = new URL(`${BASE}/v2/aggregator/transactions`);
  url.searchParams.set("search", transactionId);
  url.searchParams.set("type", "refund");
  url.searchParams.set("limit", "100");
  try {
    const res = await fetch(url, {
      headers: { Authorization: process.env.KASHIER_SECRET_KEY },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("Kashier refund lookup failed", {
        status: res.status,
        transactionId,
      });
      return { status: "unavailable" };
    }

    const payload = (await res.json()) as Record<string, unknown>;
    const records = Array.isArray(payload.body)
      ? payload.body
      : Array.isArray(payload.data)
        ? payload.data
        : null;
    if (!records) return { status: "unavailable" };

    const transaction = records
      .map((entry) =>
        parseKashierRefundTransaction(entry, expectedMerchantOrderId),
      )
      .find((entry) => entry?.transactionId === transactionId);
    return transaction ?? { status: "not_found" };
  } catch (error) {
    console.error("Kashier refund lookup request failed", {
      transactionId,
      error,
    });
    return { status: "unavailable" };
  }
}

/** Search a Kashier order's refunds when an old attempt has no stored refund ID. */
export async function queryKashierRefundsForOrder(
  merchantOrderId: string,
): Promise<KashierRefundOrderLookup> {
  if (!merchantOrderId) return { status: "unavailable" };
  return searchKashierRefundTransactions(merchantOrderId, merchantOrderId);
}

export async function resolveKashierRefundOrderId(
  sessionId?: string | null,
  fallbackOrderId?: string | null,
): Promise<string | null> {
  if (!sessionId || !process.env.KASHIER_SECRET_KEY)
    return fallbackOrderId ?? null;
  const url = `${BASE}/v3/payment/sessions/${encodeURIComponent(
    sessionId,
  )}/payment`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: process.env.KASHIER_SECRET_KEY },
      cache: "no-store",
    });
    const json = (await res.json()) as Record<string, unknown>;
    const data = (json.data ?? json.response ?? json) as Record<
      string,
      unknown
    >;
    const orderId = String(data.orderId ?? "");
    if (orderId && orderId !== "NA") return orderId;
  } catch {}
  return fallbackOrderId ?? null;
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
