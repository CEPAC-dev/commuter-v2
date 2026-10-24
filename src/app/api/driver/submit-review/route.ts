import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { getSession } from "@/lib/auth/session";
import { notifyAdminsDriverUpdate } from "@/lib/services/driverNotification";

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
  plateChar1: { en: "License plate (letter 1)", ar: "لوحة السيارة (حرف 1)" },
  plateChar2: { en: "License plate (letter 2)", ar: "لوحة السيارة (حرف 2)" },
  plateChar3: { en: "License plate (letter 3)", ar: "لوحة السيارة (حرف 3)" },
  plateDigits: { en: "License plate (numbers)", ar: "لوحة السيارة (أرقام)" },
  licenseExpiry: { en: "License expiry", ar: "تاريخ انتهاء الرخصة" },
  nationalIdFront: { en: "National ID (Front)", ar: "البطاقة الشخصية (الأمامية)" },
  nationalIdBack: { en: "National ID (Back)", ar: "البطاقة الشخصية (الخلفية)" },
  drivingLicense: { en: "Driving license", ar: "رخصة القيادة" },
  carLicenseFront: { en: "Car license (Front)", ar: "رخصة السيارة (الأمامية)" },
  carLicenseBack: { en: "Car license (Back)", ar: "رخصة السيارة (الخلفية)" },
  criminalRecord: { en: "Criminal record certificate", ar: "شهادة السجل الجنائي" },
  profilePic: { en: "Profile picture", ar: "الصورة الشخصية" },
  carImage: { en: "Car image", ar: "صورة السيارة" },
};

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "driver")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const driver = await Driver.findOne({ userId: session.userId })
    .populate("userId", "name")
    .lean<{
      _id: string;
      userId: { _id: string; name: string };
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

  const missingKeys: string[] = [];
  const missing: string[] = [];
  const missingAr: string[] = [];
  for (const field of REQUIRED_VEHICLE_FIELDS) {
    if (!driver[field]) {
      missingKeys.push(field);
      missing.push(FIELD_LABELS[field].en);
      missingAr.push(FIELD_LABELS[field].ar);
    }
  }
  for (const field of REQUIRED_DOC_FIELDS) {
    if (!driver.documents?.[field]) {
      missingKeys.push(field);
      missing.push(FIELD_LABELS[field].en);
      missingAr.push(FIELD_LABELS[field].ar);
    }
  }

  if (missing.length)
    return NextResponse.json(
      {
        error: "Please complete all required fields before submitting.",
        errorAr: "يرجى إكمال جميع الحقول المطلوبة قبل الإرسال.",
        missing,
        missingAr,
        missingKeys,
      },
      { status: 400 },
    );

  await Driver.updateOne(
    { userId: session.userId },
    { verificationStatus: "pending" },
  );

  // Notify admins
  await notifyAdminsDriverUpdate(
    String(driver._id),
    driver.userId.name,
    true // First submit
  );

  return NextResponse.json({ ok: true, verificationStatus: "pending" });
}
