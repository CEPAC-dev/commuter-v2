import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { isValidObjectId } from "mongoose";

export const dynamic = "force-dynamic";

// Keep these requirements and labels in sync with /api/driver/submit-review.
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

const FIELD_LABELS: Record<string, { en: string; ar: string }> = {
  carType: { en: "Car type", ar: "نوع السيارة" },
  carBrand: { en: "Car brand", ar: "ماركة السيارة" },
  carModel: { en: "Car model", ar: "موديل السيارة" },
  modelYear: { en: "Model year", ar: "سنة الصنع" },
  vehicleColor: { en: "Color", ar: "لون السيارة" },
  plateChar1: {
    en: "License plate (letter 1)",
    ar: "لوحة السيارة (حرف 1)",
  },
  plateChar2: {
    en: "License plate (letter 2)",
    ar: "لوحة السيارة (حرف 2)",
  },
  plateChar3: {
    en: "License plate (letter 3)",
    ar: "لوحة السيارة (حرف 3)",
  },
  plateDigits: {
    en: "License plate (numbers)",
    ar: "لوحة السيارة (أرقام)",
  },
  licenseExpiry: { en: "License expiry", ar: "تاريخ انتهاء الرخصة" },
  nationalIdFront: {
    en: "National ID (Front)",
    ar: "البطاقة الشخصية (الأمامية)",
  },
  nationalIdBack: {
    en: "National ID (Back)",
    ar: "البطاقة الشخصية (الخلفية)",
  },
  drivingLicense: { en: "Driving license", ar: "رخصة القيادة" },
  carLicenseFront: {
    en: "Car license (Front)",
    ar: "رخصة السيارة (الأمامية)",
  },
  carLicenseBack: {
    en: "Car license (Back)",
    ar: "رخصة السيارة (الخلفية)",
  },
  criminalRecord: {
    en: "Criminal record certificate",
    ar: "شهادة السجل الجنائي",
  },
  profilePic: { en: "Profile picture", ar: "الصورة الشخصية" },
  carImage: { en: "Car image", ar: "صورة السيارة" },
};

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await adminAuth();
  if (!authorization.authorized) return authorization.response;

  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid driver ID" }, { status: 400 });
  }

  const body = await req.json();
  const { verificationStatus } = body;

  if (
    !verificationStatus ||
    !["incomplete", "pending", "verified"].includes(verificationStatus)
  ) {
    return NextResponse.json(
      { error: "Invalid verification status" },
      { status: 400 },
    );
  }

  await connectDB();

  const driver = await Driver.findById(id);
  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  if (driver.verificationStatus === verificationStatus) {
    return NextResponse.json({
      message: "Status updated successfully",
      driver: {
        _id: driver._id,
        verificationStatus: driver.verificationStatus,
      },
    });
  }

  if (verificationStatus === "verified") {
    const profile = driver as unknown as Record<string, unknown> & {
      documents?: Record<string, string | null | undefined>;
    };
    const missingKeys: string[] = [];
    const missing: string[] = [];
    const missingAr: string[] = [];

    for (const field of REQUIRED_VEHICLE_FIELDS) {
      if (!profile[field]) {
        missingKeys.push(field);
        missing.push(FIELD_LABELS[field].en);
        missingAr.push(FIELD_LABELS[field].ar);
      }
    }
    for (const field of REQUIRED_DOC_FIELDS) {
      if (!profile.documents?.[field]) {
        missingKeys.push(field);
        missing.push(FIELD_LABELS[field].en);
        missingAr.push(FIELD_LABELS[field].ar);
      }
    }

    if (missing.length) {
      return NextResponse.json(
        {
          error:
            "Complete all required driver details and documents before verification.",
          errorAr:
            "يرجى استكمال بيانات السائق والمستندات المطلوبة قبل التحقق.",
          missing,
          missingAr,
          missingKeys,
        },
        { status: 400 },
      );
    }
  }

  const updatedDriver = await Driver.findByIdAndUpdate(
    id,
    { verificationStatus },
    { new: true },
  );
  if (!updatedDriver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  return NextResponse.json({
    message: "Status updated successfully",
    driver: {
      _id: updatedDriver._id,
      verificationStatus: updatedDriver.verificationStatus,
    },
  });
}
