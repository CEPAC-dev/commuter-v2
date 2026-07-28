import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { getSession } from "@/lib/auth/session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { label, address, lat, lng } = await req.json();
    if (!label?.trim())
      return NextResponse.json({ error: "Label required." }, { status: 400 });
    if (!address?.trim())
      return NextResponse.json({ error: "Address required." }, { status: 400 });

    const setFields: Record<string, unknown> = {
      "savedAddresses.$.label": label.trim(),
      "savedAddresses.$.address": address.trim(),
    };
    if (typeof lat === "number") setFields["savedAddresses.$.lat"] = lat;
    if (typeof lng === "number") setFields["savedAddresses.$.lng"] = lng;

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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  await User.findByIdAndUpdate(session.userId, {
    $pull: { savedAddresses: { _id: id } },
  });
  return NextResponse.json({ ok: true });
}
