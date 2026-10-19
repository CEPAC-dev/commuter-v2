import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { getSession } from "@/lib/auth/session";

const REQUIRED_VEHICLE_FIELDS = [
  "carType",
  "carBrand",
  "carModel",
  "modelYear",
  "vehicleColor",
  "plateChar1",
  "plateChar2",
  "plateChar3",
  "plateDigits",
  "licenseExpiry",
] as const;

const REQUIRED_DOC_FIELDS = [
  "nationalIdFront",
  "nationalIdBack",
  "drivingLicense",
  "carLicenseFront",
  "carLicenseBack",
  "criminalRecord",
  "profilePic",
  "carImage",
] as const;

const FIELD_LABELS: Record<string, string> = {
  carType: "Car type",
  carBrand: "Car brand",
  carModel: "Car model",
  modelYear: "Model year",
  vehicleColor: "Color",
  plateChar1: "License plate (letter 1)",
  plateChar2: "License plate (letter 2)",
  plateChar3: "License plate (letter 3)",
  plateDigits: "License plate (numbers)",
  licenseExpiry: "License expiry",
  nationalIdFront: "National ID (Front)",
  nationalIdBack: "National ID (Back)",
  drivingLicense: "Driving license",
  carLicenseFront: "Car license (Front)",
  carLicenseBack: "Car license (Back)",
  criminalRecord: "Criminal record certificate",
  profilePic: "Profile picture",
  carImage: "Car image",
};

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "driver")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const driver = await Driver.findOne({ userId: session.userId }).lean<{
    _id: string;
    verificationStatus: string;
    documents?: Record<string, string | null>;
    [key: string]: unknown;
  }>();
  if (!driver)
    return NextResponse.json(
      { error: "Driver profile not found." },
      { status: 404 },
    );

  if (driver.verificationStatus !== "incomplete")
    return NextResponse.json(
      {
        error: "Already submitted for review.",
        verificationStatus: driver.verificationStatus,
      },
      { status: 400 },
    );

  const missing: string[] = [];
  for (const field of REQUIRED_VEHICLE_FIELDS) {
    if (!driver[field]) missing.push(FIELD_LABELS[field]);
  }
  for (const field of REQUIRED_DOC_FIELDS) {
    if (!driver.documents?.[field]) missing.push(FIELD_LABELS[field]);
  }

  if (missing.length)
    return NextResponse.json(
      {
        error: "Please complete all required fields before submitting.",
        missing,
      },
      { status: 400 },
    );

  await Driver.updateOne(
    { userId: session.userId },
    { verificationStatus: "pending" },
  );

  return NextResponse.json({ ok: true, verificationStatus: "pending" });
}
