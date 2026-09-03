"use client";

import { useEffect, useState } from "react";
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
} from "recharts";
import { AdminCard, AdminLoadingState } from "@/components/admin/layout";

type SeriesPoint = { date: string; sumEgp: number; count: number };
type TypeBreakdown = { type: string; count: number };

const PIE_COLORS = [
  "var(--color-secondary)",
  "var(--color-primary-mid)",
  "var(--color-accent)",
  "var(--color-success)",
  "var(--color-danger)",
  "var(--color-info)",
];

function formatDay(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function TransactionsChart() {
  const [data, setData] = useState<{ series: SeriesPoint[]; byType: TypeBreakdown[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/transactions/timeseries?days=30", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData({ series: [], byType: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return (
      <AdminCard>
        <AdminLoadingState title="Loading transaction trends…" />
      </AdminCard>
    );
  }

  const chartData = data.series.map((point) => ({ ...point, label: formatDay(point.date) }));
  const hasVolume = data.series.some((point) => point.sumEgp > 0 || point.count > 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
      <AdminCard title="Collected revenue — last 30 days" padding="16px 20px">
        {hasVolume ? (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted)" }} interval="preserveStartEnd" />
              <YAxis yAxisId="egp" tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={48} />
              <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={32} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12 }}
                formatter={(value, name) =>
                  name === "sumEgp" ? [`${value} EGP`, "Collected"] : [String(value), "Transactions"]
                }
              />
              <Bar yAxisId="egp" dataKey="sumEgp" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Line yAxisId="count" type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <AdminLoadingState title="No collected transactions in this period" description="Chart will populate once payments are captured." />
        )}
      </AdminCard>

      <AdminCard title="Volume by type" padding="16px 20px">
        {data.byType.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data.byType}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.byType.map((entry, index) => (
                  <Cell key={entry.type} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <AdminLoadingState title="No transactions yet" />
        )}
      </AdminCard>
    </div>
  );
}
