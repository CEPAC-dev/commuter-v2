import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { validateChatReportReviewInput } from "@/lib/chatReports";
import { ChatReport } from "@/models/ChatReport";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const authorization = await adminAuth();
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { errorCode: "REPORT_NOT_FOUND", error: "Chat report not found." },
      { status: 404 },
    );
  }

  let body: { status?: unknown; adminNote?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { errorCode: "INVALID_BODY", error: "Invalid request body." },
      { status: 400 },
    );
  }
  const validated = validateChatReportReviewInput(body);
  if (!validated.ok) {
    const messages: Record<string, string> = {
      INVALID_REVIEW_STATUS: "Status must be reviewed or dismissed.",
      INVALID_ADMIN_NOTE: "The admin note is invalid.",
      ADMIN_NOTE_TOO_LONG: "The note must be 1000 characters or fewer.",
    };
    return NextResponse.json(
      {
        errorCode: validated.errorCode,
        error: messages[validated.errorCode],
      },
      { status: 400 },
    );
  }

  await connectDB();
  const updated = await ChatReport.findOneAndUpdate(
    { _id: id, status: "open" },
    {
      $set: {
        status: validated.status,
        adminNote: validated.adminNote,
        reviewedBy: authorization.userId,
        reviewedAt: new Date(),
      },
    },
    { returnDocument: "after", runValidators: true },
  )
    .select("_id status adminNote reviewedAt")
    .lean();
  if (updated) {
    return NextResponse.json({
      id: String(updated._id),
      status: updated.status,
      adminNote: updated.adminNote ?? "",
      reviewedAt: updated.reviewedAt,
    });
  }

  const exists = await ChatReport.exists({ _id: id });
  return exists
    ? NextResponse.json(
        { errorCode: "REPORT_NOT_OPEN", error: "This report has already been reviewed." },
        { status: 409 },
      )
    : NextResponse.json(
        { errorCode: "REPORT_NOT_FOUND", error: "Chat report not found." },
        { status: 404 },
      );
}
