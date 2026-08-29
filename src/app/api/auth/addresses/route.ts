import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { getSession } from "@/lib/auth/session";
import {
  normalizePlainText,
  validateMutationRequest,
} from "@/lib/security/request";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const user = await User.findById(session.userId)
    .select("savedAddresses")
    .lean<{ savedAddresses?: unknown[] }>();
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ savedAddresses: user.savedAddresses ?? [] });
}

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

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
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    )
      return NextResponse.json(
        { error: "lat and lng are required numbers." },
        { status: 400 },
      );

    await connectDB();
    const user = await User.findByIdAndUpdate(
      session.userId,
      {
        $push: {
          savedAddresses: {
            label: safeLabel,
            address: safeAddress,
            lat,
            lng,
          },
        },
      },
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

    if (!user)
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    const list = user.savedAddresses ?? [];
    return NextResponse.json(
      { savedAddress: list[list.length - 1] },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to save address." },
      { status: 500 },
    );
  }
}
