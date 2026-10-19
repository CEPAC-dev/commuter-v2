import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const MessageSchema = new Schema(
  {
    tripId: { type: Types.ObjectId, ref: "Trip", required: true, index: true },
    senderId: { type: Types.ObjectId, ref: "User", required: true },
    senderRole: {
      type: String,
      required: true,
      enum: ["user", "driver"],
      default: "user",
    },
    kind: {
      type: String,
      required: true,
      enum: ["text", "preset"],
      default: "text",
    },
    presetKey: { type: String, required: false, trim: true },
    text: { type: String, required: false, trim: true, maxlength: 500 },
  },
  { timestamps: true }, // createdAt, updatedAt
);

MessageSchema.index({ tripId: 1, createdAt: 1 });

export type MessageDoc = InferSchemaType<typeof MessageSchema>;
export const Message = models.Message || model("Message", MessageSchema);
