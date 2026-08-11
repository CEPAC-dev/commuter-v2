import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const ReferralUsageSchema = new Schema(
  {
    referrer: { type: Types.ObjectId, ref: "User", required: true, index: true },
    referredUser: { type: Types.ObjectId, ref: "User", required: true },
    discountPercentage: { type: Number, required: true, min: 0, max: 100 },
    tripsRemaining: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      required: true,
      enum: ["active", "exhausted"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true, collection: "referral_usages" },
);

ReferralUsageSchema.index({ referrer: 1, status: 1, createdAt: 1 });
ReferralUsageSchema.index({ referredUser: 1 }, { unique: true });

export type ReferralUsageDoc = InferSchemaType<typeof ReferralUsageSchema>;
export const ReferralUsage =
  models.ReferralUsage || model("ReferralUsage", ReferralUsageSchema);