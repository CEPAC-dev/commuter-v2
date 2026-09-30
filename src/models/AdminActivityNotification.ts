import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const AdminActivityNotificationSchema = new Schema(
  {
    adminId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    eventType: {
      type: String,
      required: true,
      enum: [
        "paid_trip_created",
        "completed_paid_trip",
        "admin_campaign_claim",
      ],
      index: true,
    },
    dedupeKey: { type: String, required: true },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, required: true, maxlength: 500 },
    data: { type: Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, required: true, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "admin_activity_notifications" },
);

AdminActivityNotificationSchema.index(
  { adminId: 1, dedupeKey: 1 },
  { unique: true },
);
AdminActivityNotificationSchema.index({ adminId: 1, createdAt: -1 });

export type AdminActivityNotificationDoc = InferSchemaType<
  typeof AdminActivityNotificationSchema
>;
export const AdminActivityNotification =
  models.AdminActivityNotification ||
  model("AdminActivityNotification", AdminActivityNotificationSchema);
