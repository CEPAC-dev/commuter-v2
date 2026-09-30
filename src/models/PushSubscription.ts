import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const PushSubscriptionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true, maxlength: 2048 },
    expirationTime: { type: Number, default: null },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true, collection: "push_subscriptions" },
);

PushSubscriptionSchema.index({ userId: 1, updatedAt: -1 });

export type PushSubscriptionDoc = InferSchemaType<
  typeof PushSubscriptionSchema
>;
export const PushSubscription =
  models.PushSubscription || model("PushSubscription", PushSubscriptionSchema);
