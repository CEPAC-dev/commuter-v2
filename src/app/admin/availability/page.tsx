import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { User } from "@/models/User";
import AdminAvailabilityTable from "@/components/admin/AdminAvailabilityTable";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";

export default async function AdminAvailabilityPage() {
  const session = await getSession();
  if (!session) redirect("/admin/signup");
  if (session.role !== "admin") redirect("/admin/signup");

  await connectDB();
  const records = await Availability.find().sort({ dayOfWeek: 1 }).lean();
  const driverIds = Array.from(new Set(records.map((record) => String(record.driverId))));
  const drivers = await User.find({ _id: { $in: driverIds }, role: "driver" })
    .select("name phone userNumber")
    .sort({ name: 1 })
    .lean();
  const byDriver = new Map<
    string,
    { _id: string; name: string; phone: string; userNumber?: number; records: typeof records }
  >();
  for (const driver of drivers) {
    byDriver.set(String(driver._id), {
      _id: String(driver._id),
      name: driver.name ?? "",
      phone: driver.phone ?? "",
      userNumber: driver.userNumber,
      records: [],
    });
  }
  for (const record of records) {
    const driver = byDriver.get(String(record.driverId));
    if (driver) driver.records.push(record);
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Availability"
        description={`${byDriver.size} driver${byDriver.size === 1 ? "" : "s"} with recurring weekly schedules.`}
      />
      <AdminAvailabilityTable
        initialRecords={Array.from(byDriver.values()).map((driver) => ({
          id: driver._id,
          name: driver.name,
          phone: driver.phone,
          userNumber: driver.userNumber,
          records: driver.records.map((record) => ({
            _id: String(record._id),
            dayOfWeek: record.dayOfWeek,
            origin: record.origin,
            startTime: record.startTime,
            endTime: record.endTime,
            active: record.active,
          })),
        }))}
      />
    </AdminPageContainer>
  );
}