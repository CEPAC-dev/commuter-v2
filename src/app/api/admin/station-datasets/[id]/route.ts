import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { StationDataset } from "@/models/StationDataset";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(
    undefined,
    req.nextUrl.searchParams.get("region"),
  );
  if (!auth.authorized) return auth.response;
  const { id } = await params;
  if (!Types.ObjectId.isValid(id))
    return NextResponse.json({ error: "Invalid dataset id." }, { status: 400 });
  await connectDB();
  const dataset = await StationDataset.findOne({
    _id: id,
    regionCode: auth.region.code,
  }).lean();
  if (!dataset)
    return NextResponse.json({ error: "Dataset not found." }, { status: 404 });
  return NextResponse.json({ dataset });
}
