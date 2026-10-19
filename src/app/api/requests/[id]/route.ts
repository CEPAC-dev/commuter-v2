import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { expireStaleRequest, getUserRequest } from "@/lib/services/requests";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id))
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  await expireStaleRequest(id, session.userId);
  const request = await getUserRequest(session.userId, id);
  if (!request)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ data: request });
}
