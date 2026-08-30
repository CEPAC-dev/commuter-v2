import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const SavedAddressSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
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
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
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
      maxlength: 13,
      match: /^\+20\d{10}$/,
    },
    passwordHash: { type: String, required: true, select: false },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    profilePic: {
      type: String,
      default: null,
      maxlength: 300,
      match: /^\/assets\/uploads\/[A-Za-z0-9/_-]+\.[A-Za-z0-9]+$/,
    },
    // null = never chosen/detected yet; the client detects it from geolocation.
    region: {
      type: String,
      default: null,
      enum: ["EG", "KSA", null],
      index: true,
    },
    savedAddresses: { type: [SavedAddressSchema], default: [] },
    // Fine-grained admin permissions (e.g. "transactions.view"). Empty/absent
    // for role=admin = full access (backward compat with pre-permission admins).
    permissions: { type: [String], default: [] },
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: Types.ObjectId, ref: "User", default: null },
    referralUnlimited: { type: Boolean, default: false },
  },
  { timestamps: true }, // createdAt, updatedAt
);

const existingUserModel = models.User;
if (existingUserModel) {
  if (!existingUserModel.schema.path("region")) {
    existingUserModel.schema.add({
      region: {
        type: String,
        default: null,
        enum: ["EG", "KSA", null],
        index: true,
      },
    });
  }
  if (!existingUserModel.schema.path("referralUnlimited")) {
    existingUserModel.schema.add({
      referralUnlimited: { type: Boolean, default: false },
    });
  }
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
