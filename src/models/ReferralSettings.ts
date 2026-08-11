import { Schema, model, models, type InferSchemaType } from "mongoose";

const ReferralSettingsSchema = new Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      default: "global",
      unique: true,
      immutable: true,
    },
    discountPercentage: { type: Number, required: true, default: 5, min: 0, max: 100 },
    maxUsersPerCode: { type: Number, required: true, default: 10, min: 1 },
    discountValidForTrips: { type: Number, required: true, default: 3, min: 1 },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, collection: "referral_settings" },
);

export type ReferralSettingsDoc = InferSchemaType<typeof ReferralSettingsSchema>;
export const ReferralSettings =
  models.ReferralSettings || model("ReferralSettings", ReferralSettingsSchema);