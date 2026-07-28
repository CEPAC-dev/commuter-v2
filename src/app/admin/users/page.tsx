import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { connectDB } from "@/lib/db/mongoose";
import { Users } from "lucide-react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import UserManagementClient from "@/components/admin/UserManagementClient";

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
    <main style={{ minHeight: "100dvh", background: "linear-gradient(180deg, #f8f9fa 0%, #eef2f5 100%)", padding: "32px 20px 80px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#00C2A8" }}>Admin panel</p>
            <h1 style={{ margin: "6px 0 0", fontSize: "clamp(28px, 4vw, 36px)", fontWeight: 800, color: "#0B1E3D" }}>Users</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <a href="/admin/dashboard" style={{ textDecoration: "none", padding: "11px 16px", borderRadius: 999, color: "#0B1E3D", fontWeight: 700, background: "#ffffff", border: "1px solid #e8edf0" }}>Back to dashboard</a>
            <AdminLogoutButton />
          </div>
        </div>

        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(0,194,168,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={20} style={{ color: "#00C2A8" }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0B1E3D" }}>Registered accounts</h2>
            <p style={{ margin: "4px 0 0", color: "#5A6A7A", fontSize: 14 }}>Change roles, review driver info, and update verification status.</p>
          </div>
        </div>

        <UserManagementClient
          initialUsers={rows}
          title="User management"
          description="Open any row to inspect documents and update driver approval."
          emptyMessage="No users found."
        />
      </div>
    </main>
  );
}
