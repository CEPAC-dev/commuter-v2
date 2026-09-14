import { GridFSBucket, ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ filename: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = await params;
  if (!/^[a-f0-9-]+\.(jpg|png|webp|pdf)$/i.test(filename)) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  try {
    const mongoose = await connectDB();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection is unavailable");
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
        "Content-Type":
          file.metadata?.contentType || "application/octet-stream",
        "Content-Length": String(file.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to read file" }, { status: 500 });
  }
}
