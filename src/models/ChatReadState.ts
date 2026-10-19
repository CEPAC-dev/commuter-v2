import { Schema, model, models, Types, type InferSchemaType } from "mongoose";
import { CHAT_RETENTION_DAYS } from "@/lib/chatRetention";

export const CHAT_READ_STATE_UNIQUE_INDEX = {
  keys: { tripId: 1 as const, userId: 1 as const },
  options: {
    unique: true as const,
    name: "chat_read_state_trip_user_unique",
  },
};

export const CHAT_READ_STATE_TTL_INDEX = {
  keys: { updatedAt: 1 as const },
  options: {
    expireAfterSeconds: (CHAT_RETENTION_DAYS + 7) * 24 * 60 * 60,
    name: "chat_read_state_updated_at_ttl",
  },
};

const ChatReadStateSchema = new Schema(
  {
    tripId: { type: Types.ObjectId, ref: "Trip", required: true },
    userId: { type: Types.ObjectId, ref: "User", required: true },
    lastReadAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "chat_read_states" },
);

ChatReadStateSchema.index(
  CHAT_READ_STATE_UNIQUE_INDEX.keys,
  CHAT_READ_STATE_UNIQUE_INDEX.options,
);
ChatReadStateSchema.index(
  CHAT_READ_STATE_TTL_INDEX.keys,
  CHAT_READ_STATE_TTL_INDEX.options,
);

export type ChatReadStateDoc = InferSchemaType<typeof ChatReadStateSchema>;
export const ChatReadState =
  models.ChatReadState || model("ChatReadState", ChatReadStateSchema);
