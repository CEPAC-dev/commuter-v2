import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import DriverManagementClient from "@/components/admin/DriverManagementClient";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";

function toPlainValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => toPlainValue(item));
  if (typeof value === "object") {
    if (typeof (value as { toJSON?: () => unknown }).toJSON === "function") {
      return toPlainValue((value as { toJSON: () => unknown }).toJSON());
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([key, nestedValue]) => [key, toPlainValue(nestedValue)],
      ),
    );
  }
  return value;
}

export default async function AdminDriversPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/signup");
  if (session.role !== "admin") redirect("/admin/signup");

  const params = await searchParams;
  const initialDriverId =
    typeof params.driver === "string" && params.driver.length > 0
      ? params.driver
      : undefined;

  await connectDB();

  const [driverProfiles, users] = await Promise.all([
    Driver.find({}).sort({ createdAt: -1 }).lean(),
    User.find({ role: "driver" })
      .select("_id name email phone userNumber createdAt")
      .lean(),
  ]);

  const userMap = new Map(
    users.map((user) => [String(user._id), toPlainValue(user)]),
  );

  const rows = driverProfiles.map((driver) => {
    const plainDriver = toPlainValue(driver) as Record<string, unknown>;
    const user = userMap.get(String(plainDriver.userId)) as Record<
      string,
      unknown
    > | undefined;

    // Count missing documents
    const docs = plainDriver.documents as Record<string, string | null> | undefined;
    const requiredDocs = [
      "nationalIdFront",
      "nationalIdBack",
      "drivingLicense",
      "carLicenseFront",
      "carLicenseBack",
      "criminalRecord",
      "profilePic",
      "carImage",
    ];
    const missingDocs = requiredDocs.filter((doc) => !docs?.[doc]);
    const hasAllDocs = missingDocs.length === 0;

    // Check if vehicle info is complete
    const hasVehicleInfo = !!(
      plainDriver.carType &&
      plainDriver.carBrand &&
      plainDriver.carModel &&
      plainDriver.modelYear &&
      plainDriver.vehicleColor &&
      plainDriver.plateChar1 &&
      plainDriver.plateChar2 &&
      plainDriver.plateChar3 &&
      plainDriver.plateDigits &&
      plainDriver.licenseExpiry
    );

    return {
      _id: String(plainDriver._id),
      userId: String(plainDriver.userId),
      userName: user?.name as string | undefined,
      userEmail: user?.email as string | undefined,
      userPhone: user?.phone as string | undefined,
      userNumber: user?.userNumber as number | undefined,
      gender: plainDriver.gender as "male" | "female" | undefined,
      verificationStatus: plainDriver.verificationStatus as
        | "incomplete"
        | "pending"
        | "verified",
      carType: plainDriver.carType as string | undefined,
      carBrand: plainDriver.carBrand as string | undefined,
      carModel: plainDriver.carModel as string | undefined,
      modelYear: plainDriver.modelYear as number | undefined,
      vehicleColor: plainDriver.vehicleColor as string | undefined,
      plateChar1: plainDriver.plateChar1 as string | undefined,
      plateChar2: plainDriver.plateChar2 as string | undefined,
      plateChar3: plainDriver.plateChar3 as string | undefined,
      plateDigits: plainDriver.plateDigits as string | undefined,
      licenseExpiry: plainDriver.licenseExpiry as string | undefined,
      carCapacity: plainDriver.carCapacity as number | undefined,
      documents: docs,
      missingDocuments: missingDocs,
      hasAllDocuments: hasAllDocs,
      hasVehicleInfo,
      createdAt: plainDriver.createdAt as string | undefined,
    };
  });

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Driver Management"
        description="Review driver applications, verify documents, and manage driver status."
      />
      <DriverManagementClient
        initialDrivers={rows}
        initialDriverId={initialDriverId}
      />
    </AdminPageContainer>
  );
}
