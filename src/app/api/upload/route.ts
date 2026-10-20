import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { GridFSBucket } from "mongodb";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "application/pdf": ".pdf",
};

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".pdf"];

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function getFileExtension(file: File): string | null {
  // Try MIME type first
  if (file.type && ALLOWED_TYPES[file.type]) {
    return ALLOWED_TYPES[file.type];
  }

  // Fallback: extract extension from filename
  const name = file.name.toLowerCase();
  const lastDot = name.lastIndexOf(".");
  if (lastDot === -1) return null;

  const ext = name.slice(lastDot);
  return ALLOWED_EXTENSIONS.includes(ext) ? ext : null;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File))
      return NextResponse.json({ error: "No file provided." }, { status: 400 });

    const ext = getFileExtension(file);
    if (!ext)
      return NextResponse.json(
        {
          error: "Unsupported file type. Use JPG, PNG, WEBP or PDF.",
          debug: {
            mimeType: file.type || "empty",
            filename: file.name
          }
        },
        { status: 400 },
      );

    if (file.size > MAX_SIZE)
      return NextResponse.json(
        { error: "File too large. Max 5MB." },
        { status: 400 },
      );

    const filename = `${randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const mongoose = await connectDB();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection is unavailable");
    const bucket = new GridFSBucket(db, {
      bucketName: "uploads",
    });
    await new Promise<void>((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(filename, {
        metadata: { contentType: file.type, originalName: file.name },
      });
      uploadStream.once("error", reject);
      uploadStream.once("finish", () => resolve());
      uploadStream.end(buffer);
    });

    const relativePath = `/api/upload/${filename}`;
    return NextResponse.json({ ok: true, path: relativePath }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
