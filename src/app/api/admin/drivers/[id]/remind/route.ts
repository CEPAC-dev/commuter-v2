import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import { createNotification } from "@/lib/notifications/createNotification";
import { isValidObjectId } from "mongoose";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid driver ID" }, { status: 400 });
  }

  const body = await req.json();
  const { userId } = body;

  if (!userId || !isValidObjectId(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  await connectDB();

  const [driver, user] = await Promise.all([
    Driver.findById(id).lean(),
    User.findById(userId).lean(),
  ]);

  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Determine which documents are missing
  const docs = driver.documents as Record<string, string | null> | undefined;
  const requiredDocs = {
    nationalIdFront: { en: "National ID (front)", ar: "البطاقة الشخصية (الأمامية)" },
    nationalIdBack: { en: "National ID (back)", ar: "البطاقة الشخصية (الخلفية)" },
    drivingLicense: { en: "Driving license", ar: "رخصة القيادة" },
    carLicenseFront: { en: "Car license (front)", ar: "رخصة السيارة (الأمامية)" },
    carLicenseBack: { en: "Car license (back)", ar: "رخصة السيارة (الخلفية)" },
    criminalRecord: { en: "Criminal record", ar: "السجل الجنائي" },
    profilePic: { en: "Profile picture", ar: "الصورة الشخصية" },
    carImage: { en: "Car image", ar: "صورة السيارة" },
  };

  const missingDocs = Object.entries(requiredDocs).filter(
    ([key]) => !docs?.[key],
  );

  const hasVehicleInfo = !!(
    driver.carType &&
    driver.carBrand &&
    driver.carModel &&
    driver.modelYear &&
    driver.vehicleColor &&
    driver.plateDigits
  );

  // Build bilingual notification message
  const missingEn = missingDocs.map(([, v]) => v.en);
  const missingAr = missingDocs.map(([, v]) => v.ar);

  const titleEn = "Complete Your Driver Profile";
  let bodyEn = "Your driver profile is incomplete. Please complete the following to start receiving rides:\n\n";
  const titleAr = "أكمل ملفك الشخصي كسائق";
  let bodyAr = "ملفك الشخصي غير مكتمل. يرجى إكمال التالي لبدء استقبال الرحلات:\n\n";

  if (!hasVehicleInfo) {
    bodyEn += "• Vehicle information (brand, model, year, color, plate)\n";
    bodyAr += "• بيانات السيارة (الماركة، الموديل، السنة، اللون، اللوحة)\n";
  }

  if (missingDocs.length > 0) {
    bodyEn += `• Missing documents: ${missingEn.join(", ")}\n`;
    bodyAr += `• المستندات الناقصة: ${missingAr.join("، ")}\n`;
  }

  bodyEn += "\nLogin to your account to complete your profile.";
  bodyAr += "\nسجل دخول لحسابك لإكمال ملفك.";

  try {
    // Create bilingual notification (shows in app + push)
    await createNotification({
      userId,
      type: "driver_profile_reminder",
      title: titleEn,
      body: bodyEn,
      titleAr: titleAr,
      bodyAr: bodyAr,
      data: {
        linkUrl: "/profile",
        missingDocuments: missingDocs.map(([k]) => k),
        hasVehicleInfo,
        sentByAdmin: session.userId,
      },
    });

    return NextResponse.json({
      message: "Reminder sent successfully",
      sent: {
        notification: true,
        missingDocuments: missingDocs.length,
        hasVehicleInfo,
      },
    });
  } catch (error) {
    console.error("Failed to send reminder:", error);
    return NextResponse.json(
      { error: "Failed to send reminder" },
      { status: 500 },
    );
  }
}