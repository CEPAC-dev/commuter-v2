import { Schema, model, models, Types } from "mongoose";

const SmsOtpSchema = new Schema(
  {
    purpose: {
      type: String,
      required: true,
      enum: ["phone_verification", "password_change", "password_reset"],
      index: true,
    },
    userId: { type: Types.ObjectId, ref: "User", default: null, index: true },
    phone: { type: String, required: true, index: true },
    role: { type: String, enum: ["passenger", "driver"], default: null },
    codeHash: { type: String, required: true, select: false },
    attempts: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true, expires: 0, index: true },
  },
  { timestamps: true },
);

SmsOtpSchema.index({ purpose: 1, userId: 1, phone: 1, createdAt: -1 });

export const SmsOtp = models.SmsOtp || model("SmsOtp", SmsOtpSchema);
