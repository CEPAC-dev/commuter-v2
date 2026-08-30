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

export interface PassengerCancellationTierConfig {
  daysBeforeMin: number;
  daysBeforeMax?: number | null;
  timeOfDayRule?: "before_match" | "during_match" | "after_match" | null;
  refundPercent: number;
  penaltyPercent: number;
  blocked?: boolean;
  label: string;
}

export const DEFAULT_PASSENGER_CANCELLATION_TIERS: PassengerCancellationTierConfig[] = [
  {
    daysBeforeMin: 4,
    daysBeforeMax: null,
    timeOfDayRule: null,
    refundPercent: 95,
    penaltyPercent: 5,
    blocked: false,
    label: "four_plus_days_before",
  },
  {
    daysBeforeMin: 2,
    daysBeforeMax: 3,
    timeOfDayRule: null,
    refundPercent: 90,
    penaltyPercent: 10,
    blocked: false,
    label: "two_to_three_days_before",
  },
  {
    daysBeforeMin: 1,
    daysBeforeMax: 1,
    timeOfDayRule: "before_match",
    refundPercent: 75,
    penaltyPercent: 25,
    blocked: false,
    label: "day_before_pre_match",
  },
  {
    daysBeforeMin: 1,
    daysBeforeMax: 1,
    timeOfDayRule: "during_match",
    refundPercent: 0,
    penaltyPercent: 100,
    blocked: true,
    label: "day_before_during_match",
  },
  {
    daysBeforeMin: 1,
    daysBeforeMax: 1,
    timeOfDayRule: "after_match",
    refundPercent: 50,
    penaltyPercent: 50,
    blocked: false,
    label: "day_before_post_match",
  },
  {
    daysBeforeMin: 0,
    daysBeforeMax: 0,
    timeOfDayRule: null,
    refundPercent: 0,
    penaltyPercent: 100,
    blocked: false,
    label: "same_day",
  },
];

const AdminSettingsSchema = new Schema(
  {
    walletReserveAmount: { type: Number, required: true, default: 200 },
    availabilityLockTime: { type: String, required: true, default: "17:00" },
    cancellationTiers: {
      type: [CancellationTierSchema],
      default: [
        { startTime: "00:00", endTime: "17:00", action: "free", penaltyPercent: 0 },
        { startTime: "17:00", endTime: "19:00", action: "blocked", penaltyPercent: 0 },
        { startTime: "19:00", endTime: "21:00", action: "ride_only", penaltyPercent: 25 },
        { startTime: "21:00", endTime: "23:00", action: "ride_only", penaltyPercent: 50 },
        { startTime: "23:00", endTime: "23:59", action: "ride_only", penaltyPercent: 110 },
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
