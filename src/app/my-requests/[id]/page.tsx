import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";

export const dynamic = "force-dynamic";

export default async function MyRequestRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/my-trips");
  if (session.role === "admin") redirect("/admin/dashboard");

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) redirect("/my-trips");

  await connectDB();
  const request = await Request.findOne({
    _id: id,
    userId: new Types.ObjectId(session.userId),
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();
  if (!request) redirect("/my-trips");

  const trip = await Trip.findOne({
    requestId: request._id,
    userId: new Types.ObjectId(session.userId),
  })
    .sort({ date: 1, cycleIndex: 1 })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();
  if (!trip) redirect("/my-trips");

  redirect(`/my-trips/${trip._id}`);
}