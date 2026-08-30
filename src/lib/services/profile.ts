import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import type { UserRole } from "@/lib/auth/session";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import type { SavedAddress } from "@/types/shared";
import { isRegionKey, type RegionKey } from "@/lib/config/regions";

interface ProfileUser {
  userNumber: number;
  name: string;
  email: string;
  phone: string;
  phoneVerifiedAt: string | null;
  region: RegionKey | null;
  savedAddresses: SavedAddress[];
}

export interface PassengerProfile extends ProfileUser {
  role: "passenger" | "admin";
  profilePic: string | null;
}

export interface DriverProfile extends ProfileUser {
  role: "driver";
  gender: "male" | "female";
  carType: "private" | "taxi" | "van" | "microbus" | "";
  carBrand: string;
  carModel: string;
  modelYear: number | null;
  vehicleColor: string;
  plateChar1: string;
  plateChar2: string;
  plateChar3: string;
  plateDigits: string;
  licenseExpiry: string;
  carCapacity?: number;
  verificationStatus: "incomplete" | "pending" | "verified";
  documents: Record<string, string | null>;
  profileSince: string;
}

function serializeAddresses(addresses: SavedAddress[] = []): SavedAddress[] {
  return addresses.map((address) => ({ ...address, _id: String(address._id) }));
}

export async function getProfile(
  userId: string,
  role: UserRole,
): Promise<PassengerProfile | DriverProfile | null> {
  await connectDB();

  const user = await User.findById(userId)
    .select("userNumber name email phone phoneVerifiedAt profilePic region savedAddresses")
    .lean<{
      userNumber: number;
      name: string;
      email: string;
      phone?: string;
      phoneVerifiedAt?: Date | string | null;
      profilePic?: string | null;
      region?: string;
      savedAddresses?: SavedAddress[];
    }>();
  if (!user) return null;

  const profileUser: ProfileUser = {
    userNumber: user.userNumber,
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    phoneVerifiedAt: user.phoneVerifiedAt
      ? new Date(user.phoneVerifiedAt).toISOString()
      : null,
    region: isRegionKey(user.region) ? user.region : null,
    savedAddresses: serializeAddresses(user.savedAddresses),
  };
  if (role !== "driver")
    return {
      ...profileUser,
      role,
      profilePic: user.profilePic ?? null,
    };

  const driver = await Driver.findOne({ userId }).lean<{
    gender: "male" | "female";
    carType?: "private" | "taxi" | "van" | "microbus";
    carBrand?: string;
    carModel?: string;
    modelYear?: number;
    vehicleColor?: string;
    plateChar1?: string;
    plateChar2?: string;
    plateChar3?: string;
    plateDigits?: string;
    licenseExpiry?: string;
    carCapacity?: number;
    verificationStatus: "incomplete" | "pending" | "verified";
    documents: Record<string, string | null>;
    createdAt: Date | string;
  }>();
  if (!driver) return null;

  return {
    ...profileUser,
    role: "driver",
    gender: driver.gender,
    carType: driver.carType ?? "",
    carBrand: driver.carBrand ?? "",
    carModel: driver.carModel ?? "",
    modelYear: driver.modelYear ?? null,
    vehicleColor: driver.vehicleColor ?? "",
    plateChar1: driver.plateChar1 ?? "",
    plateChar2: driver.plateChar2 ?? "",
    plateChar3: driver.plateChar3 ?? "",
    plateDigits: driver.plateDigits ?? "",
    licenseExpiry: driver.licenseExpiry ?? "",
    carCapacity: driver.carCapacity,
    verificationStatus: driver.verificationStatus,
    documents: driver.documents ?? {},
    profileSince:
      driver.createdAt instanceof Date
        ? driver.createdAt.toISOString()
        : String(driver.createdAt),
  };
}
