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
    text: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }, // createdAt, updatedAt
);

MessageSchema.index({ tripId: 1, createdAt: 1 });

export type MessageDoc = InferSchemaType<typeof MessageSchema>;
export const Message = models.Message || model("Message", MessageSchema);
