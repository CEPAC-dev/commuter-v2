import { Schema, model, models, type InferSchemaType } from "mongoose";

export const ADMIN_REFERRAL_ROLES = ["passenger", "driver"] as const;
export type AdminReferralRole = (typeof ADMIN_REFERRAL_ROLES)[number];

const AdminReferralCampaignSchema = new Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ADMIN_REFERRAL_ROLES,
      unique: true,
    },
    token: { type: String, required: true, unique: true, index: true },
    rewardAmount: { type: Number, required: true, min: 0.01, max: 1000000000 },
    maxUses: { type: Number, default: null, min: 1 },
    usedCount: { type: Number, required: true, default: 0, min: 0 },
    isActive: { type: Boolean, required: true, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, collection: "admin_referral_campaigns" },
);

AdminReferralCampaignSchema.index({ role: 1 }, { unique: true });

export type AdminReferralCampaignDoc = InferSchemaType<
  typeof AdminReferralCampaignSchema
>;
export const AdminReferralCampaign =
  models.AdminReferralCampaign ||
  model("AdminReferralCampaign", AdminReferralCampaignSchema);
