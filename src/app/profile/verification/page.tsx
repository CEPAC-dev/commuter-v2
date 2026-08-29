import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/services/profile";
import DriverVerificationClient from "./DriverVerificationClient";

export const metadata = { title: "Driver verification — Commuter" };

export default async function DriverVerificationPage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/profile/verification");
  if (session.role !== "driver") redirect("/profile");

  const profile = await getProfile(session.userId, session.role);
  if (!profile || profile.role !== "driver") redirect("/profile");

  return (
    <DriverVerificationClient
      email={profile.email}
      name={profile.name}
      phone={profile.phone}
      carType={profile.carType}
      carBrand={profile.carBrand}
      carModel={profile.carModel}
      modelYear={profile.modelYear}
      vehicleColor={profile.vehicleColor}
      plateChar1={profile.plateChar1}
      plateChar2={profile.plateChar2}
      plateChar3={profile.plateChar3}
      plateDigits={profile.plateDigits}
      licenseExpiry={profile.licenseExpiry}
      carCapacity={profile.carCapacity}
      documents={profile.documents}
      verificationStatus={profile.verificationStatus}
      profileSince={profile.profileSince}
    />
  );
}
