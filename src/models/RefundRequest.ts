import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const RefundRequestSchema = new Schema(
  {
    tripId: {
      type: Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    passengerId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requestedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    retainedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    tier: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: "pending",
      enum: ["pending", "approved", "rejected"],
      index: true,
    },
    reviewedAt: {
      type: Date,
      required: false,
    },
    reviewedBy: {
      type: Types.ObjectId,
      ref: "User",
      required: false,
    },
    rejectionReason: {
      type: String,
      required: false,
    },
  },
  { timestamps: true, collection: "refund_requests" },
);

RefundRequestSchema.index({ status: 1, requestedAt: -1 });
RefundRequestSchema.index({ passengerId: 1, requestedAt: -1 });

export type RefundRequestDoc = InferSchemaType<typeof RefundRequestSchema>;
export const RefundRequest =
  models.RefundRequest || model("RefundRequest", RefundRequestSchema);
