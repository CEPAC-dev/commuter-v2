import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

/**
 * Wallet ledger. Every balance movement is recorded here.
 * - topup:      user adds funds (settled via Kashier). Starts `pending`, becomes
 *               `completed` once the gateway confirms, then credits the wallet.
 * - payment:    funds spent paying for a booking (always `completed`).
 * - refund:     funds returned to the wallet.
 * - earning:    driver credited after a completed trip.
 * - referral_bonus: referral credit after a referred user's first completed trip.
 * - withdrawal: driver cashes out to bank/mobile wallet via Kashier Payouts.
 */
const WalletTransactionSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "topup",
        "payment",
        "refund",
        "earning",
        "referral_bonus",
        "withdrawal",
        // Mixed-payment reservation lifecycle.
        "payment_reserved",
        "payment_released",
        "payment_captured",
        "payment_refund_partial",
        // Gateway (card) leg of a Payment — mirrors gatewayAmountEgp so
        // Kashier-only or mixed payments appear in the ledger/admin views.
        "kashier_payment",
        // Driver penalty for cancelling ride late
        "cancellation_penalty",
      ],
    },
    amountEgp: { type: Number, required: true, min: 0.01, max: 1000000000 },
    status: {
      type: String,
      required: true,
      default: "completed",
      enum: ["pending", "completed", "failed"],
    },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    balanceAfterEgp: { type: Number, min: 0, max: 1000000000 },
    bookingId: { type: Types.ObjectId, ref: "Booking" },
    rideId: { type: Types.ObjectId, ref: "Ride" },
    paymentId: {
      type: Types.ObjectId,
      ref: "Payment",
      index: true,
      sparse: true,
    },
    tripId: { type: Types.ObjectId, ref: "Trip" },
    referralUsageId: {
      type: Types.ObjectId,
      ref: "ReferralUsage",
      index: true,
    },

    // ── Kashier (topup + withdrawal) ──
    kashierSessionId: { type: String },
    kashierOrderId: { type: String },
    kashierTransactionIds: { type: [String], default: [] },
    kashierPayoutId: { type: String },

    // ── Withdrawal destination (masked for display) ──
    payoutMethod: { type: String, enum: ["mobile_wallet", "bank"] },
    payoutDestination: { type: String },
  },
  { timestamps: true },
);

WalletTransactionSchema.index(
  { userId: 1, type: 1, tripId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "earning", tripId: { $exists: true } },
  },
);

// Admin ledger read patterns.
WalletTransactionSchema.index({ createdAt: -1 });
WalletTransactionSchema.index({ type: 1, status: 1, createdAt: -1 });
WalletTransactionSchema.index({ userId: 1, createdAt: -1 });
WalletTransactionSchema.index({ kashierOrderId: 1 });

WalletTransactionSchema.pre(
  [
    "deleteOne",
    "deleteMany",
    "findOneAndDelete",
    "findOneAndReplace",
    "replaceOne",
  ],
  function () {
    throw new Error(
      "Wallet ledger entries are immutable and cannot be deleted or replaced.",
    );
  },
);

export type WalletTransactionDoc = InferSchemaType<
  typeof WalletTransactionSchema
>;
export const WalletTransaction =
  models.WalletTransaction ||
  model("WalletTransaction", WalletTransactionSchema);
