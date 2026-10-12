import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  cancelWholeRequest,
  RequestGroupCancellationError,
} from "@/lib/requestGroupCancellation";

function errorStatus(error: RequestGroupCancellationError): number {
  return error.code === "REQUEST_NOT_FOUND" ? 404 : 409;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let reason: string | undefined;
  try {
    const body = (await req.json()) as { reason?: unknown };
    if (typeof body.reason === "string") reason = body.reason;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await cancelWholeRequest({
      requestId: id,
      userId: session.userId,
      reason,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof RequestGroupCancellationError) {
      return NextResponse.json(
        { errorCode: error.code, error: error.message },
        { status: errorStatus(error) },
      );
    }
    console.error("Failed to cancel Request group", error);
    return NextResponse.json(
      { error: "Unable to cancel this Request." },
      { status: 500 },
    );
  }
}
