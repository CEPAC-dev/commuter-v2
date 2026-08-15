import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const ReferralUsageSchema = new Schema(
  {
    referrer: { type: Types.ObjectId, ref: "User", required: true, index: true },
    referredUser: { type: Types.ObjectId, ref: "User", required: true },
    referrerBonusAmount: { type: Number, required: true, min: 0 },
    refereeBonusAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      required: true,
      enum: ["pending", "credited"],
      default: "pending",
      index: true,
    },
    creditedAt: { type: Date, default: null },
    firstTripId: { type: Types.ObjectId, ref: "Trip", default: null, index: true },
  },
  { timestamps: true, collection: "referral_usages" },
);

ReferralUsageSchema.index({ referrer: 1, status: 1, createdAt: 1 });
ReferralUsageSchema.index({ referredUser: 1 }, { unique: true });

export type ReferralUsageDoc = InferSchemaType<typeof ReferralUsageSchema>;
export const ReferralUsage =
  models.ReferralUsage || model("ReferralUsage", ReferralUsageSchema);