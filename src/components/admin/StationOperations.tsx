"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminCard } from "@/components/admin/layout";

type Dataset = { _id: string; version: number; status: string; file: { originalName: string; size: number; checksumSha256: string }; stationCount: number; newCount: number; updatedCount: number; removedCount: number; unchangedCount: number; publishedAt?: string; uploadedAt?: string };
type GeoFile = { path: string; size: number; modifiedAt: string };
type PreviewStation = { objectId: number; name: string };

const fieldStyle = { border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 10px", fontSize: 14 } as const;
const buttonStyle = { border: 0, borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: "pointer", background: "var(--color-primary)", color: "var(--color-on-primary)" } as const;

export default function StationOperations({ regionCode }: { regionCode: string }) {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [files, setFiles] = useState<GeoFile[]>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
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
      const [nextSummary, history, audit, fileData] = await Promise.all([
        request("/api/admin/station-operations/summary"), request("/api/admin/station-datasets/history"),
        request("/api/admin/station-operations/audit?limit=12"), request("/api/admin/station-files"),
      ]);
      setSummary(nextSummary); setDatasets(history.datasets ?? []); setLogs(audit.logs ?? []); setFiles(fileData.files ?? []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load station operations."); }
  }, [request]);
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
  async function removeFile(filePath: string) {
    if (!window.confirm(`Remove ${filePath}? This cannot be undone.`)) return;
    try { await request("/api/admin/station-files", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: filePath }) }); setMessage("GeoJSON file removed."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not remove file."); }
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
    <AdminCard title="GeoJSON files" description="Files currently available under public/geo. Removing a source file also makes its dataset download unavailable.">
      <div style={{ overflowX: "auto" }}><table className="admin-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}><thead><tr><th style={{ textAlign: "left", padding: "10px 12px" }}>Path</th><th style={{ textAlign: "left", padding: "10px 12px" }}>Size</th><th style={{ textAlign: "left", padding: "10px 12px" }}>Modified</th><th style={{ padding: "10px 12px" }}>Action</th></tr></thead><tbody>{files.map((geoFile) => <tr key={geoFile.path}><td style={{ padding: "10px 12px", wordBreak: "break-word" }}>{geoFile.path}</td><td style={{ padding: "10px 12px" }}>{(geoFile.size / 1024).toFixed(1)} KB</td><td style={{ padding: "10px 12px" }}>{new Date(geoFile.modifiedAt).toLocaleString()}</td><td style={{ padding: "10px 12px" }}><button type="button" style={{ ...buttonStyle, background: "var(--color-danger)" }} onClick={() => removeFile(geoFile.path)}>Remove</button></td></tr>)}</tbody></table></div>
    </AdminCard>
    <AdminCard title="Dataset management" description="Uploading never changes live stations. Validate and review changes before publishing.">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}><input style={fieldStyle} type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><button style={buttonStyle} type="button" onClick={upload}>Upload GeoJSON</button></div>
      {message && <p role="status">{message}</p>}
      <div style={{ overflowX: "auto", marginTop: 16 }}><table className="admin-table" style={{ width: "100%", minWidth: 760, borderCollapse: "separate", borderSpacing: 0 }}><thead><tr>{["Version", "Status", "Source", "Changes", "Actions"].map((head) => <th key={head} style={{ padding: "12px 14px", textAlign: "left" }}>{head}</th>)}</tr></thead><tbody>{datasets.map((dataset) => <tr key={dataset._id}><td style={{ padding: "12px 14px" }}>v{dataset.version}</td><td style={{ padding: "12px 14px" }}>{dataset.status}</td><td style={{ padding: "12px 14px" }}>{dataset.file.originalName}</td><td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>+{dataset.newCount} / ~{dataset.updatedCount} / −{dataset.removedCount}</td><td style={{ padding: "12px 14px" }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{["UPLOADED", "INVALID"].includes(dataset.status) && <button style={buttonStyle} onClick={() => validate(dataset)}>Validate</button>}{["VALID", "PUBLISHED", "ARCHIVED"].includes(dataset.status) && <button style={buttonStyle} onClick={() => inspect(dataset)}>Preview</button>}{dataset.status === "VALID" && <button style={buttonStyle} onClick={() => publish(dataset)}>Publish</button>}{dataset.status === "ARCHIVED" && <button style={buttonStyle} onClick={() => publish(dataset, true)}>Rollback</button>}<a style={{ alignSelf: "center" }} href={`/api/admin/station-datasets/${dataset._id}/download?region=${encodeURIComponent(regionCode)}`}>Download</a></div></td></tr>)}</tbody></table></div>
      {preview && <div style={{ marginTop: 16, padding: 16, border: "1px solid var(--color-border)", borderRadius: 10 }}><strong>Preview: v{String(preview.version)}</strong><p>New {String(preview.newCount)} · Updated {String(preview.updatedCount)} · Removed {String(preview.removedCount)} · Unchanged {String(preview.unchangedCount)}</p><ul>{Array.isArray(preview.updated) && preview.updated.slice(0, 10).map((item: { station: PreviewStation; changedFields: string[] }) => <li key={item.station.objectId}>#{item.station.objectId} {item.station.name}: {item.changedFields.join(", ")}</li>)}</ul></div>}
    </AdminCard>
    <AdminCard title="Audit history" description="Append-only region-scoped operations."><ul style={{ margin: 0, paddingLeft: 18 }}>{logs.map((log) => <li key={String(log._id)}>{String(log.action)} · {new Date(String(log.createdAt)).toLocaleString()}</li>)}</ul></AdminCard>
  </div>;
}
