import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { getSession } from "@/lib/auth/session";
import {
  normalizePlainText,
  validateMutationRequest,
} from "@/lib/security/request";
import { Types } from "mongoose";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;
  if (!Types.ObjectId.isValid(id))
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { label, address, lat, lng } = await req.json();
    const safeLabel = normalizePlainText(label, { maxLength: 60 });
    const safeAddress = normalizePlainText(address, { maxLength: 300 });
    if (!safeLabel)
      return NextResponse.json({ error: "Label required." }, { status: 400 });
    if (!safeAddress)
      return NextResponse.json({ error: "Address required." }, { status: 400 });

    const setFields: Record<string, unknown> = {
      "savedAddresses.$.label": safeLabel,
      "savedAddresses.$.address": safeAddress,
    };
    if (lat !== undefined && (!Number.isFinite(lat) || lat < -90 || lat > 90))
      return NextResponse.json({ error: "Invalid latitude." }, { status: 400 });
    if (lng !== undefined && (!Number.isFinite(lng) || lng < -180 || lng > 180))
      return NextResponse.json(
        { error: "Invalid longitude." },
        { status: 400 },
      );
    if (lat !== undefined) setFields["savedAddresses.$.lat"] = lat;
    if (lng !== undefined) setFields["savedAddresses.$.lng"] = lng;

    await connectDB();
    const result = await User.findOneAndUpdate(
      { _id: session.userId, "savedAddresses._id": id },
      { $set: setFields },
      { returnDocument: "after", select: "savedAddresses" },
    ).lean<{
      savedAddresses: {
        _id: unknown;
        label: string;
        address: string;
        lat: number;
        lng: number;
      }[];
    }>();

    if (!result)
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    const updated = result.savedAddresses?.find((a) => String(a._id) === id);
    return NextResponse.json({ savedAddress: updated });
  } catch {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const invalidRequest = validateMutationRequest(req, { requireJson: false });
  if (invalidRequest) return invalidRequest;
  if (!Types.ObjectId.isValid(id))
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  await User.findByIdAndUpdate(session.userId, {
    $pull: { savedAddresses: { _id: id } },
  });
  return NextResponse.json({ ok: true });
}
