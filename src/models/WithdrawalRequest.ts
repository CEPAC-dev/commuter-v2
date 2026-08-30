import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const WithdrawalRequestSchema = new Schema(
  {
    driverId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amountEgp: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    payoutMethod: {
      type: String,
      enum: ["mobile_wallet", "bank"],
      required: true,
    },
    payoutDestination: {
      type: String,
      required: true,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    resolvedBy: {
      type: Types.ObjectId,
      ref: "User",
      default: null,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

WithdrawalRequestSchema.index({ driverId: 1, status: 1, createdAt: -1 });
WithdrawalRequestSchema.index({ status: 1, createdAt: -1 });

export type WithdrawalRequestDoc = InferSchemaType<typeof WithdrawalRequestSchema>;
export const WithdrawalRequest =
  models.WithdrawalRequest || model("WithdrawalRequest", WithdrawalRequestSchema);
