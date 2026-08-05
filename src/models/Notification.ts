import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const NotificationSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        "payment_required",
        "payment_paid",
        "payment_failed",
        "request_created",
        "trip_submitted",
        "driver_assigned",
        "trip_completed",
        "request_cancelled",
      ],
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 500 },
    data: { type: Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, required: true, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "notifications" },
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

export type NotificationDoc = InferSchemaType<typeof NotificationSchema>;
export const Notification =
  models.Notification || model("Notification", NotificationSchema);
