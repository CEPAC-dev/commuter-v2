import { Schema, model, models, type InferSchemaType } from "mongoose";

const CancellationTierSchema = new Schema(
  {
    startTime: { type: String, required: true }, // "17:00"
    endTime: { type: String, required: true }, // "19:00"
    action: {
      type: String,
      required: true,
      enum: ["free", "blocked", "ride_only"],
    },
    penaltyPercent: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const PassengerCancellationTierSchema = new Schema(
  {
    daysBeforeMin: { type: Number, required: true },
    daysBeforeMax: { type: Number, required: false, default: null },
    timeOfDayRule: {
      type: String,
      required: false,
      enum: ["before_match", "during_match", "after_match"],
      default: null,
    },
    refundPercent: { type: Number, required: true },
    penaltyPercent: { type: Number, required: true },
    blocked: { type: Boolean, required: false, default: false },
    label: { type: String, required: true },
  },
  { _id: false },
);

import {
  DEFAULT_PASSENGER_CANCELLATION_TIERS,
  type PassengerCancellationTierConfig,
} from "@/lib/config/cancellationDefaults";

export {
  DEFAULT_PASSENGER_CANCELLATION_TIERS,
  type PassengerCancellationTierConfig,
};

const AdminSettingsSchema = new Schema(
  {
    walletReserveAmount: { type: Number, required: true, default: 200 },
    defaultWithdrawalLimit: { type: Number, required: false, default: null },
    availabilityLockTime: { type: String, required: true, default: "17:00" },
    verificationMethod: {
      type: String,
      required: true,
      enum: ["sms_otp", "security_question"],
      default: "sms_otp",
    },
    cancellationTiers: {
      type: [CancellationTierSchema],
      default: [
        {
          startTime: "00:00",
          endTime: "17:00",
          action: "free",
          penaltyPercent: 0,
        },
        {
          startTime: "17:00",
          endTime: "19:00",
          action: "blocked",
          penaltyPercent: 0,
        },
        {
          startTime: "19:00",
          endTime: "21:00",
          action: "ride_only",
          penaltyPercent: 25,
        },
        {
          startTime: "21:00",
          endTime: "23:00",
          action: "ride_only",
          penaltyPercent: 50,
        },
        {
          startTime: "23:00",
          endTime: "23:59",
          action: "ride_only",
          penaltyPercent: 110,
        },
      ],
    },
    passengerCancellationTiers: {
      type: [PassengerCancellationTierSchema],
      default: DEFAULT_PASSENGER_CANCELLATION_TIERS,
    },
  },
  { timestamps: true, collection: "admin_settings" },
);

export type AdminSettingsDoc = InferSchemaType<typeof AdminSettingsSchema>;

export const AdminSettings =
  models.AdminSettings || model("AdminSettings", AdminSettingsSchema);
