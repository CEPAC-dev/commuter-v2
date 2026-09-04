import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

/**
 * Aggregate payment record for a Booking (Request). One Payment = one payment
 * attempt = potentially two money movements (wallet + Kashier). Ledger rows
 * live in WalletTransaction; Payment groups + tracks their combined lifecycle.
 */
const PaymentTimelineEventSchema = new Schema(
  {
    at: { type: Date, required: true, default: () => new Date() },
    event: { type: String, required: true },
    detail: { type: String },
    actor: {
      type: String,
      enum: ["system", "user", "admin", "kashier"],
      default: "system",
    },
    meta: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const PaymentSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    bookingId: {
      type: Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },

    totalEgp: { type: Number, required: true, min: 0 },
    walletAmountEgp: { type: Number, required: true, default: 0, min: 0 },
    gatewayAmountEgp: { type: Number, required: true, default: 0, min: 0 },

    walletStatus: {
      type: String,
      required: true,
      default: "none",
      enum: ["none", "reserved", "captured", "released", "refunded"],
    },
    gatewayStatus: {
      type: String,
      required: true,
      default: "none",
      enum: ["none", "pending", "success", "failed", "cancelled", "refunded"],
    },
    overallStatus: {
      type: String,
      required: true,
      default: "created",
      enum: [
        "created",
        "wallet_reserved",
        "kashier_pending",
        "paid",
        "failed",
        "cancelled",
        "refunded",
        "partially_refunded",
      ],
      index: true,
    },

    kashierSessionId: { type: String, index: true },
    kashierOrderId: { type: String, index: true },
    kashierTransactionIds: { type: [String], default: [] },
    kashierRefundIds: { type: [String], default: [] },

    walletReservationTxId: { type: Types.ObjectId, ref: "WalletTransaction" },
    walletCaptureTxId: { type: Types.ObjectId, ref: "WalletTransaction" },
    walletReleaseTxId: { type: Types.ObjectId, ref: "WalletTransaction" },
    walletRefundTxIds: {
      type: [Types.ObjectId],
      ref: "WalletTransaction",
      default: [],
    },

    idempotencyKey: { type: String, unique: true, sparse: true },
    paidAt: { type: Date },
    refundedAt: { type: Date },
    refundedAmountEgp: { type: Number, default: 0, min: 0 },

    timeline: { type: [PaymentTimelineEventSchema], default: [] },
  },
  { timestamps: true },
);

PaymentSchema.index({ overallStatus: 1, createdAt: -1 });
PaymentSchema.index({ userId: 1, createdAt: -1 });
// At most one in-flight Payment per booking — blocks double-checkout races
// (two tabs/double-click) from creating parallel reservations/charges.
PaymentSchema.index(
  { bookingId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      overallStatus: { $in: ["created", "wallet_reserved", "kashier_pending"] },
    },
  },
);

export type PaymentDoc = InferSchemaType<typeof PaymentSchema>;
export const Payment = models.Payment || model("Payment", PaymentSchema);
