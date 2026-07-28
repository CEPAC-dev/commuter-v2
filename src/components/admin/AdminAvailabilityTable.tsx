"use client";

import { useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";

interface AvailabilityRecord {
  _id: string;
  driver?: {
    _id?: string;
    name?: string;
    phone?: string;
  } | null;
  date?: string;
  startTime?: string;
  endTime?: string;
}

export default function AdminAvailabilityTable({ initialRecords }: { initialRecords: AvailabilityRecord[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/availability/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Unable to delete availability.");
        return;
      }
      setRecords((current) => current.filter((record) => record._id !== id));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section style={{ borderRadius: 24, background: "#ffffff", border: "1px solid #e8edf0", boxShadow: "0 10px 35px rgba(11,30,61,0.05)", overflow: "hidden" }}>
      <div style={{ padding: "18px 24px", borderBottom: "1px solid #eef2f5", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(245,166,35,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CalendarClock size={20} style={{ color: "#F5A623" }} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0B1E3D" }}>Driver availability records</h2>
          <p style={{ margin: "4px 0 0", color: "#5A6A7A", fontSize: 14 }}>Delete records directly from the admin console.</p>
        </div>
      </div>
      {error ? <p role="alert" style={{ margin: "16px 24px 0", padding: "10px 12px", borderRadius: 10, background: "rgba(231,76,60,0.08)", color: "#e74c3c", border: "1px solid rgba(231,76,60,0.2)" }}>{error}</p> : null}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8f9fa" }}>
            <tr>
              <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Driver ID</th>
              <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Driver Name</th>
              <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Date</th>
              <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Window</th>
              <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record._id} style={{ borderTop: "1px solid #eef2f5" }}>
                <td style={{ padding: "14px 16px", color: "#0B1E3D", fontWeight: 600 }}>{record.driver?._id ? String(record.driver._id).slice(-6) : "—"}</td>
                <td style={{ padding: "14px 16px", color: "#5A6A7A" }}>{record.driver?.name ?? "—"}</td>
                <td style={{ padding: "14px 16px", color: "#5A6A7A" }}>{record.date ?? "—"}</td>
                <td style={{ padding: "14px 16px", color: "#5A6A7A" }}>{record.startTime ?? "—"} → {record.endTime ?? "—"}</td>
                <td style={{ padding: "14px 16px" }}>
                  <button
                    type="button"
                    onClick={() => handleDelete(record._id)}
                    disabled={deletingId === record._id}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(231,76,60,0.25)", background: "transparent", color: "#e74c3c", cursor: deletingId === record._id ? "not-allowed" : "pointer", fontWeight: 700 }}
                  >
                    <Trash2 size={14} /> {deletingId === record._id ? "Deleting..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
