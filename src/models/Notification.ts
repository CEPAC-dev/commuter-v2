import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const NOTIFICATION_TYPES = [
  "payment_required",
  "payment_paid",
  "payment_failed",
  "request_created",
  "trip_submitted",
  "driver_assigned",
  "trip_completed",
  "request_cancelled",
  "withdrawal_approved",
  "withdrawal_rejected",
  "referral_bonus",
  "ride_offer",
  "admin_broadcast",
] as const;

const NotificationSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: NOTIFICATION_TYPES,
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

const existingNotificationModel = models.Notification;
if (existingNotificationModel) {
  const typePath = existingNotificationModel.schema.path("type");
  if (typePath && "enumValues" in typePath) {
    typePath.validators = typePath.validators.filter(
      (validator: { type?: string }) => validator.type !== "enum",
    );
    typePath.enum(...NOTIFICATION_TYPES);
  }
}

export const Notification =
  existingNotificationModel || model("Notification", NotificationSchema);
