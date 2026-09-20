import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const UserSnapshotSchema = new Schema(
  {
    name: { type: String, required: true },
    userNumber: { type: Number, default: null },
    phone: { type: String, required: true },
  },
  { _id: false },
);

const ReferralAuditLogSchema = new Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: ["referral_added", "unlimited_activated", "unlimited_deactivated"],
      index: true,
    },
    actorId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    targetUserId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    actorSnapshot: { type: UserSnapshotSchema, required: true },
    targetSnapshot: { type: UserSnapshotSchema, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "referral_audit_logs" },
);

const existingReferralAuditLogModel = models.ReferralAuditLog;
if (existingReferralAuditLogModel) {
  const eventTypePath = existingReferralAuditLogModel.schema.path("eventType");
  if (eventTypePath && !eventTypePath.enumValues.includes("unlimited_deactivated")) {
    eventTypePath.enumValues.push("unlimited_deactivated");
  }
}

ReferralAuditLogSchema.index({ eventType: 1, createdAt: -1 });

export type ReferralAuditLogDoc = InferSchemaType<typeof ReferralAuditLogSchema>;
export const ReferralAuditLog =
  existingReferralAuditLogModel || model("ReferralAuditLog", ReferralAuditLogSchema);
