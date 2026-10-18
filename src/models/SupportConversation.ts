import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const SupportConversationSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", default: null },
    contactName: { type: String, required: true, trim: true, maxlength: 100 },
    contactEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    category: {
      type: String,
      required: true,
      enum: ["booking", "trip", "payment", "account", "safety", "other"],
    },
    status: {
      type: String,
      required: true,
      enum: ["open", "waiting", "resolved"],
      default: "open",
    },
    lastMessage: { type: String, required: true, maxlength: 240 },
    lastMessageAt: { type: Date, required: true, default: Date.now },
    customerLastReadAt: { type: Date, default: null },
    adminLastReadAt: { type: Date, default: null },
    guestAccessTokenHash: { type: String, default: null, select: false },
  },
  { timestamps: true },
);

SupportConversationSchema.index({ status: 1, lastMessageAt: -1 });
SupportConversationSchema.index({ userId: 1, lastMessageAt: -1 });

export type SupportConversationDoc = InferSchemaType<
  typeof SupportConversationSchema
>;
export const SupportConversation =
  models.SupportConversation ||
  model("SupportConversation", SupportConversationSchema);
