import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

/**
 * Wallet ledger. Every balance movement is recorded here.
 * - topup:      user adds funds (settled via Kashier). Starts `pending`, becomes
 *               `completed` once the gateway confirms, then credits the wallet.
 * - payment:    funds spent paying for a booking (always `completed`).
 * - refund:     funds returned to the wallet.
 * - earning:    driver credited after a completed trip.
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
      enum: ["topup", "payment", "refund", "earning", "withdrawal"],
    },
    amountEgp: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      required: true,
      default: "completed",
      enum: ["pending", "completed", "failed"],
    },
    description: { type: String, required: true },
    balanceAfterEgp: { type: Number },
    bookingId: { type: Types.ObjectId, ref: "Booking" },
    tripId: { type: Types.ObjectId, ref: "Trip" },

    // ── Kashier (topup + withdrawal) ──
    kashierSessionId: { type: String },
    kashierOrderId: { type: String },
    kashierPayoutId: { type: String },

    // ── Withdrawal destination (masked for display) ──
    payoutMethod: { type: String, enum: ["mobile_wallet", "bank"] },
    payoutDestination: { type: String },
  },
  { timestamps: true },
);

export type WalletTransactionDoc = InferSchemaType<
  typeof WalletTransactionSchema
>;
export const WalletTransaction =
  models.WalletTransaction ||
  model("WalletTransaction", WalletTransactionSchema);
