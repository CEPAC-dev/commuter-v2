import { Schema, model, models } from "mongoose";

const CounterSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export const Counter = models.Counter || model("Counter", CounterSchema);

export async function nextSequence(sequence: string): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    sequence,
    { $inc: { value: 1 } },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).lean<{ value: number }>();

  if (!counter) throw new Error(`Could not increment ${sequence}`);
  return counter.value;
}
