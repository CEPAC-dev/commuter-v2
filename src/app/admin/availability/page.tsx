import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import AdminAvailabilityTable from "@/components/admin/AdminAvailabilityTable";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import { CalendarClock, ArrowLeft } from "lucide-react";

export default async function AdminAvailabilityPage() {
  const session = await getSession();
  if (!session) redirect("/admin/signup");
  if (session.role !== "admin") redirect("/admin/signup");

  await connectDB();
  const records = await Availability.find()
    .sort({ createdAt: -1 })
    .populate("driverId", "name phone")
    .lean();

  return (
    <main className="admin-board">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');

        .admin-board {
          --ink: #0B1E3D;
          --teal: #00C2A8;
          --teal-deep: #00877A;
          --amber: #E8A33D;
          --slate: #5A6A7A;
          --line: #E6EAEC;
          --canvas: #F6F8F7;
          font-family: 'Inter', system-ui, sans-serif;
          min-height: 100dvh;
          background: var(--canvas);
          padding: 32px 20px 80px;
        }
        .admin-board * { box-sizing: border-box; }
        .admin-board .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .admin-board .display { font-family: 'Space Grotesk', system-ui, sans-serif; }

        .back-link {
          text-decoration: none;
          padding: 11px 16px;
          border-radius: 10px;
          color: var(--ink);
          font-weight: 600;
          font-size: 14px;
          background: #ffffff;
          border: 1px solid var(--line);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: border-color 0.12s ease, background 0.12s ease;
        }
        .back-link:hover { border-color: var(--teal); background: rgba(0,194,168,0.06); }

        .avail-card {
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 20px;
          box-shadow: 0 10px 35px rgba(11,30,61,0.05);
          overflow: hidden;
          border-top: 3px solid var(--amber);
        }
        .avail-card-head {
          padding: 18px 24px;
          border-bottom: 1px solid #EEF2F5;
          display: flex;
          align-items: center;
          gap: 12px;
        }
      `}</style>

      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div>
            <p className="mono" style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#B4790C" }}>
              Admin · Schedule
            </p>
            <h1 className="display" style={{ margin: "6px 0 0", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, color: "#0B1E3D" }}>
              Availability
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#5A6A7A" }}>
              {records.length} record{records.length === 1 ? "" : "s"} submitted by drivers
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <a href="/admin/dashboard" className="back-link">
              <ArrowLeft size={15} /> Back to dashboard
            </a>
            <AdminLogoutButton />
          </div>
        </div>

        <div className="avail-card">
          <div className="avail-card-head">
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(232,163,61,0.16)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CalendarClock size={18} style={{ color: "#B4790C" }} />
            </div>
            <div>
              <h2 className="display" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0B1E3D" }}>Driver availability</h2>
              <p style={{ margin: "3px 0 0", color: "#5A6A7A", fontSize: 13 }}>Time windows drivers have submitted for upcoming trips.</p>
            </div>
          </div>

          <div style={{ padding: 20 }}>
            <AdminAvailabilityTable initialRecords={records.map((record) => ({
              _id: String(record._id),
              driver: record.driverId
                ? {
                    _id: String((record.driverId as { _id?: unknown })._id ?? record.driverId),
                    name: String((record.driverId as { name?: unknown }).name ?? ""),
                    phone: String((record.driverId as { phone?: unknown }).phone ?? ""),
                  }
                : null,
              date: String(record.date ?? ""),
              startTime: String(record.startTime ?? ""),
              endTime: String(record.endTime ?? ""),
            }))} />
          </div>
        </div>
      </div>
    </main>
  );
}