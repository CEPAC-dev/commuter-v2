import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const WalletSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balanceEgp: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 1000000000,
    },
    // Non-withdrawable reserve balance for drivers (falls back to global AdminSettings default if not set).
    reserveAmount: { type: Number, required: false },
    // Max withdrawal limit override for drivers (falls back to global AdminSettings default if not set).
    withdrawalLimit: { type: Number, required: false },
    // Amount currently tied up in pending withdrawal requests.
    pendingWithdrawalAmount: { type: Number, required: true, default: 0, min: 0 },
    // Funds held for in-flight mixed payments; available = balanceEgp - reservedBalanceEgp.
    reservedBalanceEgp: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 1000000000,
    },
    totalCreditedEgp: { type: Number, required: true, default: 0, min: 0 },
    totalDebitedEgp: { type: Number, required: true, default: 0, min: 0 },
    status: {
      type: String,
      required: true,
      default: "active",
      enum: ["active", "frozen"],
    },
    lastTransactionAt: { type: Date },
  },
  { timestamps: true },
);

WalletSchema.pre("validate", function () {
  if (this.reservedBalanceEgp > this.balanceEgp) {
    this.invalidate(
      "reservedBalanceEgp",
      "Reserved balance cannot exceed balance.",
    );
  }
});

export type WalletDoc = InferSchemaType<typeof WalletSchema>;
export const Wallet = models.Wallet || model("Wallet", WalletSchema);
