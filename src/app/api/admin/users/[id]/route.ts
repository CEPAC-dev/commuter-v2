import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { Availability } from "@/models/Availability";
import { Ride } from "@/models/Ride";
import { Wallet } from "@/models/Wallet";
import { Types } from "mongoose";
import { validateMutationRequest } from "@/lib/security/request";
import { isRegionCode } from "@/lib/config/regions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  await connectDB();
  const { id } = await params;
  if (!Types.ObjectId.isValid(id))
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  const user = await User.findById(id)
    .select("userNumber name phone profilePic")
    .lean();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ data: user });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  try {
    await connectDB();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id))
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    const body = await req.json();

    if (
      body &&
      typeof body === "object" &&
      Object.prototype.hasOwnProperty.call(body, "verificationStatus")
    ) {
      return NextResponse.json(
        {
          error:
            "Driver verification must be changed from /admin/drivers.",
          errorAr:
            "يجب تغيير حالة التحقق من السائق من خلال صفحة /admin/drivers.",
        },
        { status: 400 },
      );
    }

    if (
      body &&
      typeof body === "object" &&
      Object.prototype.hasOwnProperty.call(body, "role")
    ) {
      return NextResponse.json(
        {
          error: "Role changes are not allowed from the admin panel.",
          errorAr: "لا يُسمح بتغيير دور المستخدم من لوحة الإدارة.",
        },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {};

    if (body.defaultRegionCode !== undefined) {
      if (!isRegionCode(body.defaultRegionCode)) {
        return NextResponse.json(
          { error: "Invalid default region" },
          { status: 400 },
        );
      }
      updates.defaultRegionCode = body.defaultRegionCode;
    }

    if (body.allowedRegionCodes !== undefined) {
      if (
        !Array.isArray(body.allowedRegionCodes) ||
        !body.allowedRegionCodes.every(isRegionCode)
      ) {
        return NextResponse.json(
          { error: "Invalid allowed regions" },
          { status: 400 },
        );
      }
      const allowedRegionCodes = Array.from(new Set(body.allowedRegionCodes));
      const currentUser = await User.findById(id)
        .select("defaultRegionCode")
        .lean();
      if (!currentUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      const requestedDefault =
        body.defaultRegionCode ?? currentUser.defaultRegionCode ?? "EG-CAIRO";
      if (
        !isRegionCode(requestedDefault) ||
        !allowedRegionCodes.includes(requestedDefault)
      ) {
        return NextResponse.json(
          { error: "Allowed regions must include the default region" },
          { status: 400 },
        );
      }
      updates.allowedRegionCodes = allowedRegionCodes;
    }

    const user = await User.findByIdAndUpdate(id, updates, {
      returnDocument: "after",
    })
      .select("-passwordHash")
      .lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ data: user });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update user",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const expectedAdminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!expectedAdminPassword) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not configured on the server." },
      { status: 500 },
    );
  }
  if (req.headers.get("x-admin-password")?.trim() !== expectedAdminPassword) {
    return NextResponse.json(
      { error: "Invalid admin password." },
      { status: 401 },
    );
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    await connectDB();
    const user = await User.findById(id)
      .select("role")
      .lean<{ role: string }>();
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.role === "admin" && id === auth.userId) {
      return NextResponse.json(
        { error: "You cannot delete your own admin account." },
        { status: 400 },
      );
    }

    if (user.role === "driver") {
      const wallet = await Wallet.findOne({ userId: id })
        .select("balanceEgp")
        .lean();
      if ((wallet?.balanceEgp ?? 0) > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot delete this user because the driver still has balance in their wallet.",
          },
          { status: 409 },
        );
      }

      const attachedRide = await Ride.exists({ driverId: id });
      if (attachedRide) {
        return NextResponse.json(
          {
            error:
              "Cannot delete this user because the driver is attached to one or more rides.",
          },
          { status: 409 },
        );
      }

      await Promise.all([
        Availability.deleteMany({ driverId: id }),
        Driver.deleteOne({ userId: id }),
        Wallet.deleteOne({ userId: id }),
      ]);
    }

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted)
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to delete user",
      },
      { status: 500 },
    );
  }
}
