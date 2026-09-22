import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const AdminReferralUsageSchema = new Schema(
  {
    campaignId: {
      type: Types.ObjectId,
      ref: "AdminReferralCampaign",
      required: true,
      index: true,
    },
    recipientUserId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    rewardAmount: { type: Number, required: true, min: 0.01 },
    status: {
      type: String,
      required: true,
      enum: ["credited", "failed"],
      default: "credited",
    },
    creditedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true, collection: "admin_referral_usages" },
);

AdminReferralUsageSchema.index({ campaignId: 1, createdAt: -1 });

export type AdminReferralUsageDoc = InferSchemaType<
  typeof AdminReferralUsageSchema
>;
export const AdminReferralUsage =
  models.AdminReferralUsage ||
  model("AdminReferralUsage", AdminReferralUsageSchema);
