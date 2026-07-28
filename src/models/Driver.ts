import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const DriverDocumentsSchema = new Schema(
  {
    nationalIdFront: { type: String, default: null },
    nationalIdBack: { type: String, default: null },
    drivingLicense: { type: String, default: null },
    carLicenseFront: { type: String, default: null },
    carLicenseBack: { type: String, default: null },
    criminalRecord: { type: String, default: null },
    profilePic: { type: String, default: null },
    carImage: { type: String, default: null },
  },
  { _id: false },
);

const DriverSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    gender: { type: String, required: true, enum: ["male", "female"] },

    // ── Driver details (filled in later via /profile) ──
    carType: {
      type: String,
      enum: ["private", "taxi", "van", "microbus"],
    },
    carBrand: { type: String, trim: true },
    carModel: { type: String, trim: true },
    modelYear: { type: Number },
    vehicleColor: { type: String, trim: true },
    plateChar1: { type: String, trim: true },
    plateChar2: { type: String, trim: true },
    plateChar3: { type: String, trim: true },
    plateDigits: { type: String, trim: true }, // "9872"
    licenseExpiry: { type: String }, // "YYYY-MM-DD"
    carCapacity: { type: Number }, // server-derived from carType

    // "incomplete" until vehicle details + all documents are filled in and the
    // driver submits for review; "pending" awaits manual admin approval;
    // "verified" once approved. Source of truth for driver verification.
    verificationStatus: {
      type: String,
      required: true,
      default: "incomplete",
      enum: ["incomplete", "pending", "verified"],
    },

    documents: { type: DriverDocumentsSchema, default: () => ({}) },

    // ── Payout details for Kashier withdrawals ──
    payoutMethod: {
      type: String,
      enum: ["mobile_wallet", "bank"],
    },
    payoutMobile: { type: String, trim: true }, // 01xxxxxxxxx for Vodafone Cash etc.
    payoutBankName: { type: String, trim: true },
    payoutAccountNumber: { type: String, trim: true },
    payoutAccountHolder: { type: String, trim: true },
  },
  { timestamps: true }, // createdAt = "Profile since"
);

export type DriverDoc = InferSchemaType<typeof DriverSchema>;
export const Driver = models.Driver || model("Driver", DriverSchema);
