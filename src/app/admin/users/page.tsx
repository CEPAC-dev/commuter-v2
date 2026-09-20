import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { ReferralUsage } from "@/models/ReferralUsage";
import { connectDB } from "@/lib/db/mongoose";
import UserManagementClient from "@/components/admin/UserManagementClient";
import UnlimitedReferralCards from "@/components/admin/UnlimitedReferralCards";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";
import { isRegionCode, REGION_CODES } from "@/lib/config/regions";

function toPlainValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => toPlainValue(item));
  if (typeof value === "object") {
    if (typeof (value as { toJSON?: () => unknown }).toJSON === "function") {
      return toPlainValue((value as { toJSON: () => unknown }).toJSON());
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([key, nestedValue]) => [key, toPlainValue(nestedValue)],
      ),
    );
  }
  return value;
}

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/admin/signup");
  if (session.role !== "admin") redirect("/admin/signup");

  await connectDB();
  const [users, driverProfiles, referralUsageCounts, referralUsages] = await Promise.all([
    User.find().sort({ createdAt: -1 }).select("-passwordHash").lean(),
    Driver.find({}).lean(),
    ReferralUsage.aggregate<{ _id: unknown; count: number }>([
      { $group: { _id: "$referrer", count: { $sum: 1 } } },
    ]),
    ReferralUsage.find({})
      .sort({ createdAt: -1 })
      .populate("referredUser", "name userNumber phone")
      .lean(),
  ]);
  const driverMap = new Map(
    driverProfiles.map((driver) => [String(driver.userId), driver]),
  );
  const referralUsageMap = new Map(
    referralUsageCounts.map((item) => [String(item._id), item.count]),
  );
  const referralAdditionsMap = new Map<
    string,
    { name: string; userNumber: number | null; phone: string }[]
  >();
  for (const usage of referralUsages) {
    const referredUser = usage.referredUser as unknown as {
      name?: string;
      userNumber?: number;
      phone?: string;
    } | null;
    if (!referredUser) continue;
    const additions = referralAdditionsMap.get(String(usage.referrer)) ?? [];
    additions.push({
      name: referredUser.name ?? "Unnamed user",
      userNumber: referredUser.userNumber ?? null,
      phone: referredUser.phone ?? "—",
    });
    referralAdditionsMap.set(String(usage.referrer), additions);
  }

  const rows = users.map((user) => {
    const plainUser = toPlainValue(user) as Record<string, unknown> & {
      _id?: unknown;
    };
    const driverProfile = driverMap.get(String(plainUser._id));
    const plainDriver = driverProfile
      ? (toPlainValue(driverProfile) as Record<string, unknown>)
      : undefined;

    return {
      ...(plainUser as Record<string, unknown>),
      _id: String(plainUser._id),
      userNumber:
        typeof plainUser.userNumber === "number"
          ? plainUser.userNumber
          : undefined,
      role: typeof plainUser.role === "string" ? plainUser.role : "passenger",
      defaultRegionCode: isRegionCode(plainUser.defaultRegionCode)
        ? plainUser.defaultRegionCode
        : undefined,
      allowedRegionCodes: Array.isArray(plainUser.allowedRegionCodes)
        ? plainUser.allowedRegionCodes.filter(
            (code): code is (typeof REGION_CODES)[number] =>
              typeof code === "string" &&
              (REGION_CODES as readonly string[]).includes(code),
          )
        : [],
      referralCode:
        typeof plainUser.referralCode === "string"
          ? plainUser.referralCode
          : undefined,
      referralUsageCount: referralUsageMap.get(String(plainUser._id)) ?? 0,
      referralAdditions: referralAdditionsMap.get(String(plainUser._id)) ?? [],
      driver: plainDriver
        ? {
            _id: String(plainDriver._id),
            userId: String(plainDriver.userId),
            verificationStatus: plainDriver.verificationStatus as
              | "incomplete"
              | "pending"
              | "verified"
              | undefined,
            carType: plainDriver.carType as string | undefined,
            carBrand: plainDriver.carBrand as string | undefined,
            carModel: plainDriver.carModel as string | undefined,
            modelYear: plainDriver.modelYear as number | undefined,
            vehicleColor: plainDriver.vehicleColor as string | undefined,
            plateChar1: plainDriver.plateChar1 as string | undefined,
            plateChar2: plainDriver.plateChar2 as string | undefined,
            plateChar3: plainDriver.plateChar3 as string | undefined,
            plateDigits: plainDriver.plateDigits as string | undefined,
            licenseExpiry: plainDriver.licenseExpiry as string | undefined,
            carCapacity: plainDriver.carCapacity as number | undefined,
            documents: plainDriver.documents as
              | Record<string, string | null>
              | undefined,
          }
        : undefined,
    };
  });

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Users"
        description="Change roles, review driver information, and update verification status."
      />
      <UserManagementClient
        initialUsers={rows}
        title="Registered accounts"
        description="Open any row to inspect documents and update driver approval."
        emptyMessage="No users found."
      />
      <UnlimitedReferralCards />
    </AdminPageContainer>
  );
}
