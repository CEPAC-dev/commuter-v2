"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { AdminCard, AdminLoadingState } from "@/components/admin/layout";

type DayPoint = { date: string; label: string; trips: number; users: number };
type StatusSlice = { status: string; count: number };

const PIE_COLORS = [
  "var(--color-secondary)",
  "var(--color-primary-mid)",
  "var(--color-accent)",
  "var(--color-danger)",
  "var(--color-success)",
];

export default function DashboardCharts({
  daily,
  rideStatus,
}: {
  daily: DayPoint[];
  rideStatus: StatusSlice[];
}) {
  const hasActivity = daily.some((point) => point.trips > 0 || point.users > 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
      <AdminCard title="Trips & new users — last 14 days" padding="16px 20px">
        {hasActivity ? (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted)" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={32} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="trips" name="Trips created" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Line type="monotone" dataKey="users" name="New users" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <AdminLoadingState title="No activity in the last 14 days" description="Chart will populate as trips and users are created." />
        )}
      </AdminCard>

      <AdminCard title="Rides by status" padding="16px 20px">
        {rideStatus.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={rideStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={2}>
                {rideStatus.map((entry, index) => (
                  <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <AdminLoadingState title="No rides yet" />
        )}
      </AdminCard>
    </div>
  );
}
