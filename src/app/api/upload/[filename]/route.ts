import { GridFSBucket, ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { Driver } from "@/models/Driver";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  UPLOAD_CONTENT_TYPES,
  type AllowedUploadExtension,
} from "@/lib/uploads";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ filename: string }>;
}

const SENSITIVE_DOCUMENT_FIELDS = [
  "nationalIdFront",
  "nationalIdBack",
  "drivingLicense",
  "carLicenseFront",
  "carLicenseBack",
  "criminalRecord",
] as const;

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = await params;
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase() as
    | AllowedUploadExtension
    | string;
  if (
    !/^[a-f0-9-]+\.[a-z0-9]+$/i.test(filename) ||
    !ALLOWED_UPLOAD_EXTENSIONS.includes(extension as AllowedUploadExtension)
  ) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  try {
    const mongoose = await connectDB();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection is unavailable");

    const relativePath = `/api/upload/${filename}`;
    const sensitiveDriver = await Driver.findOne({
      $or: SENSITIVE_DOCUMENT_FIELDS.map((field) => ({
        [`documents.${field}`]: relativePath,
      })),
    })
      .select("userId")
      .lean<{ userId?: unknown }>();

    if (sensitiveDriver) {
      const adminAuthorization = await adminAuth();
      const isOwner = String(sensitiveDriver.userId) === String(session.userId);
      if (!adminAuthorization.authorized && !isOwner) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const bucket = new GridFSBucket(db, {
      bucketName: "uploads",
    });
    const file = await db.collection("uploads.files").findOne({ filename });

    if (!file || !(file._id instanceof ObjectId)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stream = bucket.openDownloadStream(file._id);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));

    return new NextResponse(Buffer.concat(chunks), {
      headers: {
        "Content-Type": UPLOAD_CONTENT_TYPES[extension as AllowedUploadExtension],
        "Content-Length": String(file.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to read file" }, { status: 500 });
  }
}
