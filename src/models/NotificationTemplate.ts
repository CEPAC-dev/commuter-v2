import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

export const DEFAULT_NOTIFICATION_TEMPLATES = [
  {
    name: "Payment reminder",
    title: "Complete your payment",
    message:
      "Your booking is waiting for payment. Complete checkout to secure your trip.",
    icon: "bell",
    style: "warning",
    linkUrl: "/my-requests",
    linkLabel: "View requests",
  },
  {
    name: "Driver assigned",
    title: "Driver assigned",
    message:
      "A driver has been assigned to your trip. Open your trip details for more information.",
    icon: "check",
    style: "success",
    linkUrl: "/my-trips",
    linkLabel: "View trip",
  },
  {
    name: "Service update",
    title: "Service update",
    message: "We have an important update about Commuter services.",
    icon: "megaphone",
    style: "info",
    linkUrl: "",
    linkLabel: "",
  },
  {
    name: "Urgent notice",
    title: "Important notice",
    message: "Please review this important notice before your next trip.",
    icon: "alert",
    style: "urgent",
    linkUrl: "/user/notifications",
    linkLabel: "Read notice",
  },
] as const;

const NotificationTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    icon: { type: String, required: true, default: "bell" },
    style: { type: String, required: true, default: "info" },
    linkUrl: { type: String, default: "", maxlength: 300 },
    linkLabel: { type: String, default: "", maxlength: 40 },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, collection: "notification_templates" },
);

NotificationTemplateSchema.index({ createdBy: 1, name: 1 }, { unique: true });

export type NotificationTemplateDoc = InferSchemaType<
  typeof NotificationTemplateSchema
>;
export const NotificationTemplate =
  models.NotificationTemplate ||
  model("NotificationTemplate", NotificationTemplateSchema);
