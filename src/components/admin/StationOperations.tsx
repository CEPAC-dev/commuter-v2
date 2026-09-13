"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminCard } from "@/components/admin/layout";
import AdminTripMap from "@/components/admin/AdminTripMap";

type Dataset = { _id: string; version: number; status: string; file: { originalName: string; size: number; checksumSha256: string }; stationCount: number; newCount: number; updatedCount: number; removedCount: number; unchangedCount: number; publishedAt?: string; uploadedAt?: string };
type Station = { _id: string; objectId: number; name: string; direction: string; zones: string; landmark: string; stationType: string; lat: number; lng: number; active: boolean };

const fieldStyle = { border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 10px", fontSize: 14 } as const;
const buttonStyle = { border: 0, borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: "pointer", background: "var(--color-primary)", color: "var(--color-on-primary)" } as const;

export default function StationOperations({ regionCode }: { regionCode: string }) {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("all");
  const [message, setMessage] = useState<string | null>(null);
  const request = useCallback(async (path: string, init?: RequestInit) => {
    const divider = path.includes("?") ? "&" : "?";
    const response = await fetch(`${path}${divider}region=${encodeURIComponent(regionCode)}`, init);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Station operation failed.");
    return body;
  }, [regionCode]);
  const load = useCallback(async () => {
    try {
      const [nextSummary, history, stationData, audit] = await Promise.all([
        request("/api/admin/station-operations/summary"), request("/api/admin/station-datasets/history"),
        request(`/api/admin/stations?q=${encodeURIComponent(query)}&active=${active === "all" ? "" : active}&limit=100`), request("/api/admin/station-operations/audit?limit=12"),
      ]);
      setSummary(nextSummary); setDatasets(history.datasets ?? []); setStations(stationData.stations ?? []); setLogs(audit.logs ?? []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load station operations."); }
  }, [active, query, request]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function upload() {
    if (!file) return setMessage("Choose a GeoJSON file first.");
    try { const form = new FormData(); form.append("file", file); const result = await request("/api/admin/station-datasets/upload", { method: "POST", body: form }); setMessage(`Uploaded dataset version ${result.version}. Validate it before publishing.`); setFile(null); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
  }
  async function validate(dataset: Dataset) {
    try { const result = await request(`/api/admin/station-datasets/${dataset._id}/validate`, { method: "POST" }); setMessage(`Validation ${result.status}: ${result.validCount} valid, ${result.invalidCount} invalid.`); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Validation failed."); }
  }
  async function inspect(dataset: Dataset) {
    try { setPreview(await request(`/api/admin/station-datasets/${dataset._id}/preview`)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Preview failed."); }
  }
  async function publish(dataset: Dataset, rollback = false) {
    const verb = rollback ? "rollback to" : "publish";
    if (!window.confirm(`Confirm ${verb} dataset version ${dataset.version}? This applies a region-scoped projection.`)) return;
    try { const result = await request(`/api/admin/station-datasets/${dataset._id}/${rollback ? "rollback" : "publish"}`, { method: "POST" }); setMessage(`${rollback ? "Rollback" : "Publication"} complete: ${result.upserted} applied, ${result.deactivated} deactivated.`); setPreview(null); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Publication failed."); }
  }
  const stats = (summary?.statistics ?? {}) as Record<string, number>;
  const activeDataset = summary?.activeDataset as Dataset | null | undefined;
  return <div style={{ display: "grid", gap: 18, marginBottom: 24 }}>
    <AdminCard title="Stations operation" description={`Region-scoped station data for ${regionCode}. Legacy stations without a region remain unavailable until the approved migration.`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        {[['Total', stats.total], ['Active', stats.active], ['Inactive', stats.inactive], ['Pending', stats.pending], ['Invalid', stats.failed]].map(([label, value]) => <div key={String(label)} style={{ padding: 12, border: "1px solid var(--color-border)", borderRadius: 10 }}><strong>{value ?? 0}</strong><div style={{ fontSize: 12 }}>{label}</div></div>)}
      </div>
      <p style={{ marginBottom: 0 }}>{activeDataset ? <>Active dataset: <strong>v{activeDataset.version}</strong> · {activeDataset.stationCount} source stations · {activeDataset.file.originalName}</> : "No active region dataset. Upload and validate a GeoJSON source to begin."}</p>
    </AdminCard>
    <AdminCard title="Dataset management" description="Uploading never changes live stations. Validate and review changes before publishing.">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}><input style={fieldStyle} type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><button style={buttonStyle} type="button" onClick={upload}>Upload GeoJSON</button></div>
      {message && <p role="status">{message}</p>}
      <div style={{ overflowX: "auto", marginTop: 12 }}><table className="admin-table"><thead><tr><th>Version</th><th>Status</th><th>Source</th><th>Changes</th><th>Actions</th></tr></thead><tbody>{datasets.map((dataset) => <tr key={dataset._id}><td>v{dataset.version}</td><td>{dataset.status}</td><td>{dataset.file.originalName}</td><td>+{dataset.newCount} / ~{dataset.updatedCount} / −{dataset.removedCount}</td><td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["UPLOADED", "INVALID"].includes(dataset.status) && <button style={buttonStyle} onClick={() => validate(dataset)}>Validate</button>}{["VALID", "PUBLISHED", "ARCHIVED"].includes(dataset.status) && <button style={buttonStyle} onClick={() => inspect(dataset)}>Preview</button>}{dataset.status === "VALID" && <button style={buttonStyle} onClick={() => publish(dataset)}>Publish</button>}{dataset.status === "ARCHIVED" && <button style={buttonStyle} onClick={() => publish(dataset, true)}>Rollback</button>}<a href={`/api/admin/station-datasets/${dataset._id}/download?region=${encodeURIComponent(regionCode)}`}>Download</a></td></tr>)}</tbody></table></div>
      {preview && <div style={{ marginTop: 14, padding: 12, border: "1px solid var(--color-border)", borderRadius: 10 }}><strong>Preview: v{String(preview.version)}</strong><p>New {String(preview.newCount)} · Updated {String(preview.updatedCount)} · Removed {String(preview.removedCount)} · Unchanged {String(preview.unchangedCount)}</p><ul>{Array.isArray(preview.updated) && preview.updated.slice(0, 10).map((item: { station: Station; changedFields: string[] }) => <li key={item.station.objectId}>#{item.station.objectId} {item.station.name}: {item.changedFields.join(", ")}</li>)}</ul></div>}
    </AdminCard>
    <AdminCard title="Station management" description="Search and inspect only the selected region. Deactivation is soft and auditable."><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input style={fieldStyle} value={query} placeholder="Name, object ID, landmark, zone" onChange={(e) => setQuery(e.target.value)} /><select style={fieldStyle} value={active} onChange={(e) => setActive(e.target.value)}><option value="all">All states</option><option value="true">Active</option><option value="false">Inactive</option></select><button style={buttonStyle} onClick={() => void load()}>Search</button></div><div style={{ marginTop: 12 }}><AdminTripMap points={stations.map((s) => ({ lat: s.lat, lng: s.lng, label: `#${s.objectId} ${s.name}`, kind: "station" as const }))} /></div><div style={{ overflowX: "auto", marginTop: 12 }}><table className="admin-table"><thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Zone</th><th>Status</th></tr></thead><tbody>{stations.map((station) => <tr key={station._id}><td>{station.objectId}</td><td>{station.name}</td><td>{station.stationType}</td><td>{station.zones}</td><td>{station.active ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div></AdminCard>
    <AdminCard title="Audit history" description="Append-only region-scoped operations."><ul style={{ margin: 0, paddingLeft: 18 }}>{logs.map((log) => <li key={String(log._id)}>{String(log.action)} · {new Date(String(log.createdAt)).toLocaleString()}</li>)}</ul></AdminCard>
  </div>;
}
