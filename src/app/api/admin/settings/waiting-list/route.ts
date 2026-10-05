import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { AdminSettings } from "@/models/AdminSettings";
import { User } from "@/models/User";
import { getSharedRideWaitingListEnabled } from "@/lib/admin/waitingList";

async function serializeSettings() {
  const settings = await AdminSettings.findOne()
    .select(
      "sharedRideWaitingListEnabled sharedRideWaitingListEnabledUpdatedBy sharedRideWaitingListEnabledUpdatedAt",
    )
    .lean<{
      sharedRideWaitingListEnabled?: boolean;
      sharedRideWaitingListEnabledUpdatedBy?: Types.ObjectId | null;
      sharedRideWaitingListEnabledUpdatedAt?: Date | null;
    } | null>();

  const updatedBy = settings?.sharedRideWaitingListEnabledUpdatedBy
    ? await User.findById(settings.sharedRideWaitingListEnabledUpdatedBy)
        .select("name")
        .lean<{ name?: string } | null>()
    : null;

  return {
    sharedRideWaitingListEnabled: getSharedRideWaitingListEnabled(
      settings?.sharedRideWaitingListEnabled,
    ),
    updatedByName: updatedBy?.name ?? null,
    updatedAt:
      settings?.sharedRideWaitingListEnabledUpdatedAt?.toISOString() ?? null,
  };
}

export async function GET() {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  await connectDB();
  return NextResponse.json({ data: await serializeSettings() });
}

export async function PATCH(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const enabled = (body as Record<string, unknown>)
    .sharedRideWaitingListEnabled;
  if (typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "sharedRideWaitingListEnabled must be a boolean." },
      { status: 400 },
    );
  }

  await connectDB();
  await AdminSettings.findOneAndUpdate(
    {},
    {
      $set: {
        sharedRideWaitingListEnabled: enabled,
        sharedRideWaitingListEnabledUpdatedBy: new Types.ObjectId(auth.userId),
        sharedRideWaitingListEnabledUpdatedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true },
  );

  return NextResponse.json({ data: await serializeSettings() });
}