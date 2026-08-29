import { Schema, model, models } from "mongoose";

const SecurityRateLimitSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, immutable: true },
    count: { type: Number, required: true, default: 0, min: 0 },
    expiresAt: { type: Date, required: true, immutable: true },
  },
  { versionKey: false },
);

SecurityRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SecurityRateLimit =
  models.SecurityRateLimit ||
  model("SecurityRateLimit", SecurityRateLimitSchema);
