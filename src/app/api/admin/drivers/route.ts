import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";

export async function GET(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  await connectDB();

  const users = await User.find({ role: "driver" })
    .sort({ userNumber: 1 })
    .select("name phone email userNumber")
    .lean<
      {
        _id: unknown;
        name?: string;
        phone?: string;
        email?: string;
        userNumber?: number;
      }[]
    >();

  const driverDocs = users.length
    ? await Driver.find({ userId: { $in: users.map((user) => user._id) } })
        .select("userId carType verificationStatus")
        .lean<
          { userId: unknown; carType?: string; verificationStatus?: string }[]
        >()
    : [];
  const detailByUserId = new Map(
    driverDocs.map((driver) => [String(driver.userId), driver]),
  );

  return NextResponse.json({
    drivers: users.map((user) => ({
      _id: String(user._id),
      name: user.name ?? "",
      phone: user.phone ?? "",
      email: user.email ?? "",
      userNumber: user.userNumber ?? null,
      carType: detailByUserId.get(String(user._id))?.carType ?? "",
      verificationStatus:
        detailByUserId.get(String(user._id))?.verificationStatus ?? "",
    })),
  });
}
