import { redirect } from "next/navigation";
import { CalendarClock, Car, Route, Users } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Trip } from "@/models/Trip";
import { Ride } from "@/models/Ride";
import { Availability } from "@/models/Availability";
import LanguageToggle from "@/components/layout/LanguageToggle";
import MatchRideForm from "@/components/admin/MatchRideForm";
import DashboardCharts from "@/components/admin/DashboardCharts";
import { AdminCard, AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";
import { AdminTopbarActions } from "@/components/admin/layout/AdminShell";
import SmsBalanceCard from "@/components/admin/SmsBalanceCard";

const DAILY_WINDOW_DAYS = 14;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function loadDashboardCharts() {
  const since = new Date();
  since.setDate(since.getDate() - (DAILY_WINDOW_DAYS - 1));
  since.setHours(0, 0, 0, 0);

  const [tripsByDay, usersByDay, ridesByStatus] = await Promise.all([
    Trip.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    ]),
    User.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    ]),
    Ride.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const tripsMap = new Map(tripsByDay.map((row) => [row._id, row.count]));
  const usersMap = new Map(usersByDay.map((row) => [row._id, row.count]));

  const daily = Array.from({ length: DAILY_WINDOW_DAYS }, (_, i) => {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = dayKey(d);
    return {
      date: key,
      label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      trips: tripsMap.get(key) ?? 0,
      users: usersMap.get(key) ?? 0,
    };
  });

  const rideStatus = ridesByStatus.map((row) => ({ status: row._id, count: row.count }));

  return { daily, rideStatus };
}

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/admin/signup");
  if (session.role !== "admin") redirect("/admin/signup");

  await connectDB();
  const [userCount, tripCount, rideCount, availabilityCount] = await Promise.all([
    User.countDocuments(),
    Trip.countDocuments(),
    Ride.countDocuments(),
    Availability.countDocuments(),
  ]);

  const charts = await loadDashboardCharts();

  const [availabilities, drivers, trips] = await Promise.all([
    Availability.find({ status: { $in: ["open", "matched"] } })
      .select("_id date startTime endTime")
      .sort({ date: 1, startTime: 1 })
      .lean(),
    User.find({ role: "driver" })
      .select("_id name phone email")
      .sort({ name: 1 })
      .lean(),
    Trip.find({
      status: { $in: ["submitted", "pending_payment", "matched"] },
      paymentStatus: "paid",
    })
      .select(
        "_id tripNumber date pickupTime arrivalTime pickup dropoff pickupStation dropoffStation vehicleType rideType priceEgp numberOfPassengers userId",
      )
      .sort({ date: 1, pickupTime: 1 })
      .lean(),
  ]);

  const cards = [
    { title: "Users", value: userCount, icon: Users, color: "var(--color-secondary)", tint: "var(--color-secondary-tint)", href: "/admin/users" },
    { title: "Rides", value: rideCount, icon: Car, color: "var(--color-success)", tint: "var(--color-success-tint)", href: "/admin/rides" },
    { title: "Trips", value: tripCount, icon: Route, color: "var(--color-primary)", tint: "var(--color-primary-tint)", href: "/admin/trips" },
    { title: "Availability", value: availabilityCount, icon: CalendarClock, color: "var(--color-warning)", tint: "var(--color-warning-tint)", href: "/admin/availability" },
  ];

  const stamp = new Date().toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <AdminPageContainer>
      <AdminPageHeader title="Dashboard" description={stamp} />
      <AdminTopbarActions><LanguageToggle /></AdminTopbarActions>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
        {cards.map(({ title, value, icon: Icon, color, tint, href }) => (
          <a key={title} href={href} style={{ color: "inherit", textDecoration: "none" }}>
            <AdminCard padding="22px 24px" style={{ borderTop: `3px solid ${color}` }}>
              <div style={{ width: 46, height: 46, borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center", background: tint, marginBottom: 18 }}>
                <Icon size={22} style={{ color }} />
              </div>
              <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>{title}</p>
              <h2 style={{ margin: "8px 0 0", color: "var(--color-primary)", fontSize: 32 }}>{value}</h2>
              <p style={{ margin: "14px 0 0", color: "var(--color-muted)", fontSize: 12.5 }}>Open {title.toLowerCase()}</p>
            </AdminCard>
          </a>
        ))}
      </div>

      <DashboardCharts daily={charts.daily} rideStatus={charts.rideStatus} />

      <SmsBalanceCard />

      <MatchRideForm
        initialDate={new Date().toISOString().slice(0, 10)}
        availabilities={availabilities.map((item) => ({
          _id: String(item._id),
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
        }))}
        drivers={drivers.map((driver) => ({
          _id: String(driver._id),
          name: driver.name,
          phone: driver.phone,
          email: driver.email,
        }))}
        trips={trips.map((trip) => ({
          _id: String(trip._id),
          tripNumber: trip.tripNumber,
          date: trip.date,
          pickupTime: trip.pickupTime,
          arrivalTime: trip.arrivalTime,
          pickup: trip.pickup,
          dropoff: trip.dropoff,
          pickupStation: trip.pickupStation,
          dropoffStation: trip.dropoffStation,
          vehicleType: trip.vehicleType,
          rideType: trip.rideType,
          priceEgp: trip.priceEgp,
          numberOfPassengers: trip.numberOfPassengers,
          userId: String(trip.userId),
        }))}
      />
    </AdminPageContainer>
  );
}
