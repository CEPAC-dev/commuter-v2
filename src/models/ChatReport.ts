import { Schema, model, models, Types, type InferSchemaType } from "mongoose";
import { CHAT_REPORT_OPEN_UNIQUE_INDEX } from "@/lib/chatReports";

const ChatReportSnapshotMessageSchema = new Schema(
  {
    senderRole: { type: String, required: true, enum: ["user", "driver"] },
    kind: { type: String, required: true, enum: ["text", "preset"] },
    presetKey: { type: String, required: false },
    text: { type: String, required: false, maxlength: 500 },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const ChatReportSchema = new Schema(
  {
    tripId: { type: Types.ObjectId, ref: "Trip", required: true },
    rideId: { type: Types.ObjectId, ref: "Ride", required: true },
    reporterId: { type: Types.ObjectId, ref: "User", required: true },
    reporterRole: {
      type: String,
      required: true,
      enum: ["passenger", "driver"],
    },
    reason: {
      type: String,
      required: true,
      enum: ["abuse", "contact_sharing", "harassment", "other"],
    },
    note: { type: String, required: false, trim: true, maxlength: 300 },
    status: {
      type: String,
      required: true,
      enum: ["open", "reviewed", "dismissed"],
      default: "open",
    },
    adminNote: { type: String, required: false, trim: true, maxlength: 1000 },
    reviewedBy: {
      type: Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    reviewedAt: { type: Date, required: false, default: null },
    snapshot: { type: [ChatReportSnapshotMessageSchema], required: true },
  },
  { timestamps: true, collection: "chat_reports" },
);

ChatReportSchema.index({ status: 1, createdAt: -1 });
ChatReportSchema.index({ tripId: 1 });
ChatReportSchema.index(
  CHAT_REPORT_OPEN_UNIQUE_INDEX.keys,
  CHAT_REPORT_OPEN_UNIQUE_INDEX.options,
);

export type ChatReportDoc = InferSchemaType<typeof ChatReportSchema>;
export const ChatReport =
  models.ChatReport || model("ChatReport", ChatReportSchema);
