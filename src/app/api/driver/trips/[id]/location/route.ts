import { NextRequest } from "next/server";
import {
  ingestDriverLocation,
  stopDriverLocation,
} from "@/lib/liveLocation/driverIngestion";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return ingestDriverLocation(request, "trip", id);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return stopDriverLocation(request, "trip", id);
}
