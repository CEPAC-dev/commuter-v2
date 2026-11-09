import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";

export interface AdminIdentity {
  name: string;
  email: string;
  profilePic: string | null;
}

export async function getAdminIdentity(userId: string): Promise<AdminIdentity | null> {
  await connectDB();
  const user = await User.findOne({ _id: userId, role: "admin" })
    .select("name email profilePic")
    .lean<{ name?: string; email?: string; profilePic?: string | null }>();

  if (!user) return null;
  return {
    name: user.name ?? "Admin",
    email: user.email ?? "",
    profilePic: user.profilePic ?? null,
  };
}
