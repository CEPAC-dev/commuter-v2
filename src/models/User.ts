import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const SavedAddressSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: true },
);

const UserSchema = new Schema(
  {
    userNumber: {
      type: Number,
      required: true,
      unique: true,
      sparse: true,
      immutable: true,
    },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      required: true,
      default: "passenger",
      enum: ["passenger", "driver", "admin"],
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    profilePic: { type: String, default: null },
    // null = never chosen/detected yet; the client detects it from geolocation.
    region: {
      type: String,
      default: null,
      enum: ["EG", "SA", null],
      index: true,
    },
    savedAddresses: { type: [SavedAddressSchema], default: [] },
    // Fine-grained admin permissions (e.g. "transactions.view"). Empty/absent
    // for role=admin = full access (backward compat with pre-permission admins).
    permissions: { type: [String], default: [] },
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }, // createdAt, updatedAt
);

const existingUserModel = models.User;
if (existingUserModel && !existingUserModel.schema.path("region")) {
  existingUserModel.schema.add({
    region: {
      type: String,
      default: null,
      enum: ["EG", "SA", null],
      index: true,
    },
  });
}

// Same phone/email may exist once per role (one person can hold a passenger
// account and a separate driver account).
UserSchema.index({ phone: 1, role: 1 }, { unique: true });
UserSchema.index(
  { email: 1, role: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);

// const existingUserModel = models.User;
// if (existingUserModel && !existingUserModel.schema.path("userNumber")) {
//   existingUserModel.schema.add({ userNumber: UserSchema.obj.userNumber });
// }

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const User = models.User || model("User", UserSchema);
