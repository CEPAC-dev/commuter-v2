import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const RatingSchema = new Schema(
  {
    tripId: {
      type: Types.ObjectId,
      ref: "Trip",
      required: true,
      unique: true,
      index: true,
    },
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    driverRating: { type: Number, required: true, min: 1, max: 5 },
    carRating: { type: Number, required: true, min: 1, max: 5 },
    feedback: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { timestamps: true }, // createdAt, updatedAt
);

export type RatingDoc = InferSchemaType<typeof RatingSchema>;
export const Rating = models.Rating || model("Rating", RatingSchema);
