import mongoose, { type InferSchemaType, type Query } from "mongoose";

const { Schema, model, models, Types } = mongoose;

const REQUEST_CREATION_DISABLED =
  "Request creation is disabled; create a Trip instead";

const RequestSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    regionCode: {
      type: String,
      enum: ["EG-CAIRO", "SA", "AE-ABU-DHABI"],
      default: null,
      index: true,
    },
    tripIds: {
      type: [Types.ObjectId],
      ref: "Trip",
      default: [],
      index: true,
    },
    dates: {
      type: [String],
      required: true,
      validate: {
        validator: (value: unknown[]) =>
          Array.isArray(value) && value.length > 0,
        message: "Request must contain at least one date",
      },
    },
    amountEgp: { type: Number, required: true },
    note: { type: String, default: "", trim: true, maxlength: 1000 },
    reviewedBy: { type: Types.ObjectId, ref: "User", required: false, default: null },
    reviewedAt: { type: Date, required: false, default: null },
    rejectionReason: { type: String, required: false, trim: true, maxlength: 500, default: null },
    paymentStatus: {
      type: String,
      required: true,
      default: "pending",
      enum: ["pending", "paid", "failed", "refunded", "expired"],
    },
    kashierSessionId: { type: String },
    kashierOrderId: { type: String },
    kashierTransactionIds: { type: [String], default: [] },
    paidAt: { type: Date },
    status: {
      type: String,
      required: true,
      default: "pending_payment",
      enum: [
        "pending_payment",
        "waiting_list",
        "approved",
        "rejected",
        "submitted",
        "matched",
        "confirmed",
        "active",
        "completed",
        "cancelled",
        "time_out",
      ],
    },
  },
  { timestamps: true, collection: "requests" },
);

export type RequestDoc = InferSchemaType<typeof RequestSchema>;
const existingRequestModel = models.Request;
if (existingRequestModel && !existingRequestModel.schema.path("regionCode")) {
  existingRequestModel.schema.add({ regionCode: RequestSchema.obj.regionCode });
}

const requestSchema = existingRequestModel?.schema ?? RequestSchema;
requestSchema.pre(
  "save",
  function (this: {
    isNew: boolean;
    $locals: Record<string, unknown>;
    $session: () => unknown;
  }) {
    if (
      this.isNew &&
      !(
        this.$locals.groupCreationApproved === true &&
        this.$session()
      )
    ) {
      throw new Error(REQUEST_CREATION_DISABLED);
    }
  },
);
requestSchema.pre("insertMany", function () {
  throw new Error(REQUEST_CREATION_DISABLED);
});

for (const method of [
  "update",
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "findOneAndReplace",
] as const) {
  requestSchema.pre(method, function (this: Query<unknown, unknown>) {
    if (this.getOptions().upsert) {
      throw new Error(REQUEST_CREATION_DISABLED);
    }
  });
}

requestSchema.pre("bulkWrite", function (...args: unknown[]) {
  const operations = args[0];
  const options = args[1];
  if (!Array.isArray(operations)) {
    throw new Error("Request bulkWrite requires an operations array");
  }

  const hasInsertOrUpsert = operations.some((operation) => {
    if (!operation || typeof operation !== "object") return false;
    const write = operation as Record<string, unknown>;
    if ("insertOne" in write) return true;
    return ["updateOne", "updateMany", "replaceOne"].some((key) => {
      const update = write[key];
      return (
        update !== null &&
        typeof update === "object" &&
        (update as Record<string, unknown>).upsert === true
      );
    });
  });
  if (
    hasInsertOrUpsert ||
    (options !== null &&
      typeof options === "object" &&
      (options as Record<string, unknown>).upsert === true)
  ) {
    throw new Error(REQUEST_CREATION_DISABLED);
  }
});

export const Request = existingRequestModel || model("Request", RequestSchema);
