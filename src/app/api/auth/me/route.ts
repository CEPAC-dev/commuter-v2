import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { getSession } from "@/lib/auth/session";
import { carTypeToCapacity, type CarType } from "@/lib/config/driver";
import { isRegionKey } from "@/lib/config/regions";
import { getProfile } from "@/lib/services/profile";
import {
  normalizePlainText,
  validateMutationRequest,
} from "@/lib/security/request";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getProfile(session.userId, session.role);
  if (!profile)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ data: profile });
}

export async function PATCH(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, phone, profilePic, region } = body;
    const safeName = normalizePlainText(name, { maxLength: 100 });
    if (!safeName)
      return NextResponse.json({ error: "Name is required." }, { status: 400 });

    const userUpdate: Record<string, unknown> = { name: safeName };
    if (region !== undefined) {
      if (!isRegionKey(region)) {
        return NextResponse.json({ error: "Invalid region." }, { status: 400 });
      }
      userUpdate.region = region;
    }
    if (phone !== undefined) {
      const trimmed = typeof phone === "string" ? phone.trim() : "";
      // Allow empty phone or valid format; only validate if non-empty.
      if (trimmed && !/^\+20\d{10}$/.test(trimmed)) {
        return NextResponse.json(
          { error: "Phone must be +20 followed by 10 digits." },
          { status: 400 },
        );
      }
      // Only update phone if explicitly provided and non-empty.
      if (trimmed) userUpdate.phone = trimmed;
    }
    // Save profilePic even if phone validation is skipped.
    if (
      typeof profilePic === "string" &&
      /^\/assets\/uploads\/[A-Za-z0-9/_-]+\.[A-Za-z0-9]+$/.test(profilePic) &&
      profilePic.length <= 300
    ) {
      userUpdate.profilePic = profilePic;
    }

    await connectDB();

    if (region === undefined) {
      await User.collection.updateMany(
        { region: { $exists: false } },
        { $set: { region: null } },
      );
    }

    const user = await User.findByIdAndUpdate(session.userId, userUpdate, {
      returnDocument: "after",
      select: "name email phone role profilePic region",
    }).lean();

    if (!user)
      return NextResponse.json({ error: "User not found." }, { status: 404 });

    if (session.role !== "driver") return NextResponse.json(user);

    const {
      gender,
      carType,
      carBrand,
      carModel,
      modelYear,
      vehicleColor,
      plateChar1,
      plateChar2,
      plateChar3,
      plateDigits,
      licenseExpiry,
      documents,
    } = body;

    const driverUpdate: Record<string, unknown> = {};
    if (gender === "male" || gender === "female") driverUpdate.gender = gender;
    if (["private", "taxi", "van", "microbus"].includes(carType)) {
      driverUpdate.carType = carType;
      // Server-authoritative capacity — never trust client input.
      driverUpdate.carCapacity = carTypeToCapacity(carType as CarType);
    }
    const safeCarBrand = normalizePlainText(carBrand, {
      maxLength: 60,
      allowEmpty: true,
    });
    const safeCarModel = normalizePlainText(carModel, {
      maxLength: 60,
      allowEmpty: true,
    });
    const safeVehicleColor = normalizePlainText(vehicleColor, {
      maxLength: 40,
      allowEmpty: true,
    });
    if (carBrand !== undefined && safeCarBrand === null)
      return NextResponse.json(
        { error: "Invalid car brand." },
        { status: 400 },
      );
    if (carModel !== undefined && safeCarModel === null)
      return NextResponse.json(
        { error: "Invalid car model." },
        { status: 400 },
      );
    if (vehicleColor !== undefined && safeVehicleColor === null)
      return NextResponse.json(
        { error: "Invalid vehicle color." },
        { status: 400 },
      );
    if (safeCarBrand) driverUpdate.carBrand = safeCarBrand;
    if (safeCarModel) driverUpdate.carModel = safeCarModel;
    if (Number.isInteger(Number(modelYear)) && Number(modelYear) > 0)
      driverUpdate.modelYear = Number(modelYear);
    if (safeVehicleColor) driverUpdate.vehicleColor = safeVehicleColor;
    if (typeof plateChar1 === "string" && /^[\u0600-\u06FF]$/.test(plateChar1))
      driverUpdate.plateChar1 = plateChar1;
    if (typeof plateChar2 === "string" && /^[\u0600-\u06FF]$/.test(plateChar2))
      driverUpdate.plateChar2 = plateChar2;
    if (typeof plateChar3 === "string" && /^[\u0600-\u06FF]$/.test(plateChar3))
      driverUpdate.plateChar3 = plateChar3;
    if (typeof plateDigits === "string" && /^\d{3,4}$/.test(plateDigits))
      driverUpdate.plateDigits = plateDigits;
    if (licenseExpiry?.trim())
      driverUpdate.licenseExpiry = licenseExpiry.trim();

    const ALLOWED_DOC_KEYS = [
      "nationalIdFront",
      "nationalIdBack",
      "drivingLicense",
      "carLicenseFront",
      "carLicenseBack",
      "criminalRecord",
      "profilePic",
      "carImage",
    ];
    if (documents && typeof documents === "object") {
      for (const key of ALLOWED_DOC_KEYS) {
        if (typeof documents[key] === "string" && documents[key]) {
          driverUpdate[`documents.${key}`] = documents[key];
        }
      }
    }

    const driver = await Driver.findOneAndUpdate(
      { userId: session.userId },
      driverUpdate,
      { returnDocument: "after" },
    ).lean();

    return NextResponse.json({ ...user, driver });
  } catch {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
