import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const SnapshotSchema = new Schema(
  {
    name: { type: String, required: true },
    userNumber: { type: Number, default: null },
    phone: { type: String, required: true },
  },
  { _id: false },
);

const AdminReferralAuditLogSchema = new Schema(
  {
    campaignId: { type: Types.ObjectId, ref: "AdminReferralCampaign", required: true, index: true },
    eventType: {
      type: String,
      required: true,
      enum: ["created", "updated", "activated", "deactivated", "redeemed"],
      index: true,
    },
    actorId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    recipientUserId: { type: Types.ObjectId, ref: "User", default: null, index: true },
    actorSnapshot: { type: SnapshotSchema, required: true },
    recipientSnapshot: { type: SnapshotSchema, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "admin_referral_audit_logs" },
);

AdminReferralAuditLogSchema.index({ campaignId: 1, createdAt: -1 });

export type AdminReferralAuditLogDoc = InferSchemaType<typeof AdminReferralAuditLogSchema>;
export const AdminReferralAuditLog =
  models.AdminReferralAuditLog || model("AdminReferralAuditLog", AdminReferralAuditLogSchema);
