import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { NotificationTemplate } from "@/models/NotificationTemplate";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id))
    return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
  const body = await req.json();
  const update: Record<string, string> = {};
  for (const key of [
    "name",
    "title",
    "message",
    "titleAr",
    "messageAr",
    "icon",
    "style",
    "linkUrl",
    "linkLabel",
    "linkLabelAr",
  ]) {
    if (typeof body[key] === "string") update[key] = body[key].trim();
  }
  await connectDB();
  const template = await NotificationTemplate.findOneAndUpdate(
    { _id: id, createdBy: auth.userId },
    { $set: update },
    { new: true, runValidators: true },
  ).lean();
  if (!template)
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  return NextResponse.json({ data: { ...template, id: String(template._id) } });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  const { id } = await params;
  if (!isValidObjectId(id))
    return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
  await connectDB();
  const result = await NotificationTemplate.deleteOne({
    _id: id,
    createdBy: auth.userId,
  });
  if (!result.deletedCount)
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
