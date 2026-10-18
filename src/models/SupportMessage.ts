import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const SupportMessageSchema = new Schema(
  {
    conversationId: {
      type: Types.ObjectId,
      ref: "SupportConversation",
      required: true,
    },
    senderId: { type: Types.ObjectId, ref: "User", default: null },
    senderRole: {
      type: String,
      required: true,
      enum: ["customer", "admin", "system"],
    },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    eventType: { type: String, enum: ["status_change"], default: null },
    status: {
      type: String,
      enum: ["open", "waiting", "resolved"],
      default: null,
    },
  },
  { timestamps: true },
);

SupportMessageSchema.index({ conversationId: 1, createdAt: 1 });
SupportMessageSchema.index({ conversationId: 1, senderRole: 1, createdAt: 1 });

export type SupportMessageDoc = InferSchemaType<typeof SupportMessageSchema>;
export const SupportMessage =
  models.SupportMessage || model("SupportMessage", SupportMessageSchema);
