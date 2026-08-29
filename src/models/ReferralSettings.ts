import { Schema, model, models, type InferSchemaType } from "mongoose";

export const REFERRAL_SETTINGS_ROLES = ["passenger", "driver"] as const;
export type ReferralSettingsRole = (typeof REFERRAL_SETTINGS_ROLES)[number];

const ReferralSettingsSchema = new Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      default: "passenger",
      unique: true,
      immutable: true,
    },
    referrerBonusAmount: { type: Number, required: true, default: 50, min: 0 },
    refereeBonusAmount: { type: Number, required: true, default: 100, min: 0 },
    maxUsersPerCode: { type: Number, required: true, default: 10, min: 1 },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, collection: "referral_settings" },
);

export type ReferralSettingsDoc = InferSchemaType<typeof ReferralSettingsSchema>;
export const ReferralSettings =
  models.ReferralSettings || model("ReferralSettings", ReferralSettingsSchema);