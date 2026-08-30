import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { connectDB } from "@/lib/db/mongoose";
import UserManagementClient from "@/components/admin/UserManagementClient";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";

function toPlainValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => toPlainValue(item));
  if (typeof value === "object") {
    if (typeof (value as { toJSON?: () => unknown }).toJSON === "function") {
      return toPlainValue((value as { toJSON: () => unknown }).toJSON());
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [key, toPlainValue(nestedValue)]),
    );
  }
  return value;
}

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/admin/signup");
  if (session.role !== "admin") redirect("/admin/signup");

  await connectDB();
  const users = await User.find().sort({ createdAt: -1 }).select("-passwordHash").lean();
  const driverProfiles = await Driver.find({}).lean();
  const driverMap = new Map(driverProfiles.map((driver) => [String(driver.userId), driver]));

  const rows = users.map((user) => {
    const plainUser = toPlainValue(user) as Record<string, unknown> & { _id?: unknown };
    const driverProfile = driverMap.get(String(plainUser._id));
    const plainDriver = driverProfile ? (toPlainValue(driverProfile) as Record<string, unknown>) : undefined;

    return {
      ...(plainUser as Record<string, unknown>),
      _id: String(plainUser._id),
      userNumber: typeof plainUser.userNumber === "number" ? plainUser.userNumber : undefined,
      role: typeof plainUser.role === "string" ? plainUser.role : "passenger",
      driver: plainDriver
        ? {
          _id: String(plainDriver._id),
          userId: String(plainDriver.userId),
          verificationStatus: (plainDriver.verificationStatus as "incomplete" | "pending" | "verified" | undefined),
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
          documents: plainDriver.documents as Record<string, string | null> | undefined,
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
    </AdminPageContainer>
  );
}
