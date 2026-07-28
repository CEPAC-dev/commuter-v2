import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Rating } from "@/models/Rating";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function assertOwnedCompletedTrip(tripId: string, userId: string) {
  if (!Types.ObjectId.isValid(tripId)) return null;
  return Trip.findOne({ _id: tripId, userId, status: "completed" })
    .select("_id")
    .lean();
}

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const rating = await Rating.findOne({
    tripId: id,
    userId: session.userId,
  }).lean<{
    driverRating: number;
    carRating: number;
    feedback: string;
  } | null>();

  return NextResponse.json({ data: rating ?? null });
}

export async function POST(req: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { driverRating?: unknown; carRating?: unknown; feedback?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const driverRating = Number(body.driverRating);
  const carRating = Number(body.carRating);
  const feedback =
    typeof body.feedback === "string"
      ? body.feedback.trim().slice(0, 1000)
      : "";

  const validRating = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5;
  if (!validRating(driverRating) || !validRating(carRating)) {
    return NextResponse.json(
      { error: "driverRating and carRating must be integers 1-5" },
      { status: 400 },
    );
  }

  await connectDB();

  const trip = await assertOwnedCompletedTrip(id, session.userId);
  if (!trip) {
    return NextResponse.json(
      { error: "Trip not found or not completed" },
      { status: 404 },
    );
  }

  const rating = await Rating.findOneAndUpdate(
    { tripId: id, userId: session.userId },
    { driverRating, carRating, feedback },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean<{ driverRating: number; carRating: number; feedback: string }>();

  return NextResponse.json({ data: rating }, { status: 201 });
}
