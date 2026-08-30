import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { Driver } from "@/models/Driver";
import AdminAvailabilityTable from "@/components/admin/AdminAvailabilityTable";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";

export default async function AdminAvailabilityPage() {
  const session = await getSession();
  if (!session) redirect("/admin/signup");
  if (session.role !== "admin") redirect("/admin/signup");

  await connectDB();
  const records = await Availability.find()
    .sort({ createdAt: -1 })
    .populate("driverId", "name phone userNumber")
    .lean();

  const driverUserIds = records
    .map((record) => {
      if (!record.driverId) return null;
      const id = (record.driverId as { _id?: unknown })._id ?? record.driverId;
      return String(id);
    })
    .filter(Boolean) as string[];

  const driverDetails = driverUserIds.length
    ? await Driver.find({ userId: { $in: driverUserIds } })
        .select("userId carType")
        .lean() 
    : [];

  const carTypeByUserId = new Map<string, string>(
    driverDetails.map((driver) => [String(driver.userId), String(driver.carType ?? "")]),
  );

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Availability"
        description={`${records.length} record${records.length === 1 ? "" : "s"} submitted by drivers.`}
      />
      <AdminAvailabilityTable initialRecords={records.map((record) => {
              const userId = record.driverId
                ? String(((record.driverId as { _id?: unknown })._id ?? record.driverId))
                : null;

              return {
                _id: String(record._id),
                driver: record.driverId
                  ? {
                      userNumber: Number((record.driverId as { userNumber?: unknown }).userNumber ?? 0),
                      name: String((record.driverId as { name?: unknown }).name ?? ""),
                      phone: String((record.driverId as { phone?: unknown }).phone ?? ""),
                      carType: userId ? carTypeByUserId.get(userId) ?? "" : "",
                    }
                  : null,
                date: String(record.date ?? ""),
                startTime: String(record.startTime ?? ""),
                endTime: String(record.endTime ?? ""),
              };
      })} />
    </AdminPageContainer>
  );
}