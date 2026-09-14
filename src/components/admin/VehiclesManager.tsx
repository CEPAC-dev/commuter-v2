"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { REGION_LIST, type RegionCode } from "@/lib/config/regions";
import type { VehicleRegionConfig } from "@/lib/config/vehicles";

type Vehicle = { key: string; label: string; ride: "private" | "shared"; active: boolean; regionConfigs: VehicleRegionConfig[] };
type VehicleResponse = Vehicle & Partial<Omit<VehicleRegionConfig, "regionCode">> & { regionCodes?: string[]; regionConfigs?: VehicleRegionConfig[] };
const numeric = ["rate", "additional_rate", "buffer", "window", "capacity", "occupancy", "min_occupancy", "minimum_charge", "vehicle_type", "trip_type", "sortOrder"] as const;
const labels: Record<(typeof numeric)[number], string> = { rate: "Rate / km", additional_rate: "Additional rate", buffer: "Buffer (minutes)", window: "Window (minutes)", capacity: "Capacity", occupancy: "Occupancy", min_occupancy: "Min occupancy", minimum_charge: "Minimum charge", vehicle_type: "Vehicle type", trip_type: "Trip type", sortOrder: "Display order" };
const defaults: Omit<VehicleRegionConfig, "regionCode"> = { rate: 0, additional_rate: 0, buffer: 0, window: 0, capacity: 1, occupancy: 1, min_occupancy: 1, minimum_charge: 0, vehicle_type: 0, trip_type: 0, sortOrder: 0 };
const blank: Vehicle = { key: "", label: "", ride: "private", active: true, regionConfigs: [] };

function newConfig(regionCode: RegionCode, sortOrder: number): VehicleRegionConfig { return { regionCode, ...defaults, sortOrder }; }
function normalizeVehicle(vehicle: VehicleResponse): Vehicle {
  const regionConfigs = Array.isArray(vehicle.regionConfigs)
    ? vehicle.regionConfigs
    : (vehicle.regionCodes ?? []).map((regionCode) => ({
        regionCode,
        rate: vehicle.rate ?? 0,
        additional_rate: vehicle.additional_rate ?? 0,
        buffer: vehicle.buffer ?? 0,
        window: vehicle.window ?? 0,
        capacity: vehicle.capacity ?? 1,
        occupancy: vehicle.occupancy ?? 1,
        min_occupancy: vehicle.min_occupancy ?? 1,
        minimum_charge: vehicle.minimum_charge ?? 0,
        vehicle_type: vehicle.vehicle_type ?? 0,
        trip_type: vehicle.trip_type ?? 0,
        sortOrder: vehicle.sortOrder ?? 0,
      }));
  return { key: vehicle.key, label: vehicle.label, ride: vehicle.ride, active: vehicle.active, regionConfigs };
}

export default function VehiclesManager() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [draft, setDraft] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const editing = Boolean(draft?.key && vehicles.some((vehicle) => vehicle.key === draft.key));
  const title = useMemo(() => editing ? `Edit ${draft?.label}` : "New vehicle", [editing, draft?.label]);
  async function load() {
    const response = await fetch("/api/admin/vehicles", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load vehicles.");
    setVehicles(data.vehicles.map(normalizeVehicle));
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, []);
  function setDraftValue<K extends keyof Vehicle>(key: K, value: Vehicle[K]) { setDraft((current) => current ? { ...current, [key]: value } : current); }
  function toggleRegion(regionCode: RegionCode) {
    setDraft((current) => {
      if (!current) return current;
      const exists = current.regionConfigs.some((config) => config.regionCode === regionCode);
      return { ...current, regionConfigs: exists ? current.regionConfigs.filter((config) => config.regionCode !== regionCode) : [...current.regionConfigs, newConfig(regionCode, current.regionConfigs.length)] };
    });
  }
  function updateConfig(regionCode: string, field: (typeof numeric)[number], value: number) {
    setDraft((current) => current ? { ...current, regionConfigs: current.regionConfigs.map((config) => config.regionCode === regionCode ? { ...config, [field]: value } : config) } : current);
  }
  async function save() {
    if (!draft) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(editing ? `/api/admin/vehicles/${encodeURIComponent(draft.key)}` : "/api/admin/vehicles", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save vehicle.");
      await load(); setDraft(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save vehicle."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleteKey) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/vehicles/${encodeURIComponent(deleteKey)}`, { method: "DELETE", headers: { "Content-Type": "application/json", "x-admin-password": password }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete vehicle.");
      await load(); setDeleteKey(null); setPassword("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete vehicle."); }
    finally { setBusy(false); }
  }
  return <div className="vehicles-manager">
    {error ? <p role="alert" className="vehicles-alert">{error}</p> : null}
    <div className="vehicles-toolbar"><div><p className="vehicles-kicker">Fleet catalog</p><p className="vehicles-subtitle">Regional fares and operating rules.</p></div><button type="button" className="vehicles-primary" onClick={() => { setDraft({ ...blank }); setError(""); }}><Plus size={17} />Add vehicle</button></div>
    {loading ? <VehicleSkeleton /> : <div className="vehicles-table-wrap"><table className="vehicles-table"><thead><tr>{["Vehicle", "Ride", "Regional pricing", "Availability", "Status", ""].map((name) => <th key={name}>{name}</th>)}</tr></thead><tbody>{vehicles.map((vehicle) => <tr key={vehicle.key}><td><strong>{vehicle.label}</strong><span>{vehicle.key}</span></td><td><span className="vehicles-pill">{vehicle.ride}</span></td><td>{vehicle.regionConfigs.map((config) => { const region = REGION_LIST.find((item) => item.code === config.regionCode); return <span className="vehicles-rate" key={config.regionCode}>{region?.currency.code} {config.rate}/km · {region?.label}</span>; })}</td><td>{vehicle.regionConfigs.length} region{vehicle.regionConfigs.length === 1 ? "" : "s"}</td><td><span className={`vehicles-status ${vehicle.active ? "is-active" : ""}`}>{vehicle.active ? "Active" : "Inactive"}</span></td><td className="vehicles-actions"><button type="button" onClick={() => { setDraft({ ...vehicle, regionConfigs: vehicle.regionConfigs.map((config) => ({ ...config })) }); setError(""); }}><Pencil size={15} />Edit</button><button type="button" className="danger" onClick={() => setDeleteKey(vehicle.key)}><Trash2 size={15} />Delete</button></td></tr>)}</tbody></table></div>}
    {draft ? <section className="vehicles-editor" aria-labelledby="vehicle-editor-title"><header><div><p className="vehicles-kicker">Vehicle configuration</p><h2 id="vehicle-editor-title">{title}</h2><p>Choose regions first. Every selected region carries independent settings and currency.</p></div><label className="vehicles-switch"><input type="checkbox" checked={draft.active} onChange={(event) => setDraftValue("active", event.target.checked)} /><span>{draft.active ? "Active" : "Inactive"}</span></label></header>
      <div className="vehicles-core"><EditorField label="Key" hint="Stable API identifier"><input disabled={editing} value={draft.key} placeholder="e.g. executive_suv" onChange={(event) => setDraftValue("key", event.target.value)} /></EditorField><EditorField label="Display name"><input value={draft.label} placeholder="e.g. Executive SUV" onChange={(event) => setDraftValue("label", event.target.value)} /></EditorField><EditorField label="Ride model"><select value={draft.ride} onChange={(event) => setDraftValue("ride", event.target.value as Vehicle["ride"])}><option value="private">Private</option><option value="shared">Shared</option></select></EditorField></div>
      <div className="vehicles-region-picker"><div><h3>Available regions</h3><p>Select every market where this vehicle can be booked.</p></div><div className="vehicles-region-options">{REGION_LIST.map((region) => { const selected = draft.regionConfigs.some((config) => config.regionCode === region.code); return <button type="button" key={region.code} onClick={() => toggleRegion(region.code)} className={`vehicles-region-option ${selected ? "selected" : ""}`} aria-pressed={selected}><span className="vehicles-check">{selected ? <Check size={14} /> : null}</span><span><strong>{region.label}</strong><small>{region.currency.code}</small></span></button>; })}</div></div>
      <div className="vehicles-region-configs">{draft.regionConfigs.length === 0 ? <p className="vehicles-empty">Select one or more regions to configure availability.</p> : draft.regionConfigs.map((config) => { const region = REGION_LIST.find((item) => item.code === config.regionCode)!; return <details key={config.regionCode} open className="vehicles-region-card"><summary><span><strong>{region.label}</strong><small>{region.currency.code} · {region.currency.locale}</small></span><ChevronDown size={18} /></summary><div className="vehicles-region-fields">{numeric.map((field) => <EditorField key={field} label={labels[field]} hint={field === "rate" || field === "additional_rate" || field === "minimum_charge" ? region.currency.code : undefined}><input type="number" min="0" step="any" value={config[field]} onChange={(event) => updateConfig(config.regionCode, field, Number(event.target.value))} /></EditorField>)}</div></details>; })}</div>
      <footer><button type="button" disabled={busy || draft.regionConfigs.length === 0} onClick={() => void save()} className="vehicles-primary">{busy ? "Saving…" : "Save vehicle"}</button><button type="button" disabled={busy} onClick={() => setDraft(null)} className="vehicles-secondary">Cancel</button></footer></section> : null}
    {deleteKey ? <section role="dialog" aria-modal="true" className="vehicles-dialog"><h2>Delete {deleteKey}?</h2><p>Permanent. Existing trips retain their stored vehicle key.</p><EditorField label="Admin password"><input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></EditorField><div><button type="button" disabled={busy || !password} className="vehicles-danger" onClick={() => void remove()}>Delete permanently</button><button type="button" className="vehicles-secondary" disabled={busy} onClick={() => { setDeleteKey(null); setPassword(""); }}>Cancel</button></div></section> : null}
    <style>{styles}</style>
  </div>;
}
function EditorField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="vehicles-field"><span>{label}{hint ? <small>{hint}</small> : null}</span>{children}</label>; }
function VehicleSkeleton() { return <div className="vehicles-skeleton" aria-label="Loading vehicles"><div /><div /><div /><div /></div>; }
const styles = `
.vehicles-manager{display:grid;gap:22px;color:#0B1E3D}.vehicles-toolbar,.vehicles-editor header,.vehicles-editor footer{display:flex;align-items:center;justify-content:space-between;gap:18px}.vehicles-kicker{margin:0 0 4px;color:#00a38f;font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}.vehicles-subtitle,.vehicles-editor header p,.vehicles-region-picker p{margin:0;color:#657588;font-size:14px}.vehicles-primary,.vehicles-danger,.vehicles-secondary{border:0;border-radius:9px;padding:10px 14px;font:inherit;font-weight:750;cursor:pointer}.vehicles-primary{display:inline-flex;align-items:center;gap:7px;background:#0B1E3D;color:#fff}.vehicles-primary:disabled,.vehicles-danger:disabled{opacity:.55;cursor:not-allowed}.vehicles-secondary{background:#eef2f5;color:#0B1E3D}.vehicles-table-wrap{overflow:auto;border:1px solid #e2e8ee;border-radius:14px;background:#fff}.vehicles-table{width:100%;min-width:900px;border-collapse:collapse}.vehicles-table th{padding:12px 16px;background:#f7f9fb;color:#657588;font-size:11px;letter-spacing:.06em;text-align:left;text-transform:uppercase}.vehicles-table td{padding:15px 16px;border-top:1px solid #edf0f3;vertical-align:top;font-size:14px}.vehicles-table td strong,.vehicles-table td span{display:block}.vehicles-table td span:not(.vehicles-pill):not(.vehicles-status):not(.vehicles-rate){margin-top:3px;color:#77879a;font-size:12px}.vehicles-rate{margin:0 0 5px;color:#53657a;font-size:12px}.vehicles-pill,.vehicles-status{width:fit-content;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:700;background:#eef2f5;color:#53657a}.vehicles-status.is-active{background:rgba(0,194,168,.12);color:#00877a}.vehicles-actions{display:flex;gap:4px}.vehicles-actions button{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:#0B1E3D;padding:6px;cursor:pointer;font:inherit;font-size:13px;font-weight:700}.vehicles-actions .danger{color:#b42318}.vehicles-editor,.vehicles-dialog{border:1px solid #dce5ec;border-radius:16px;background:#fff;padding:26px;box-shadow:0 12px 28px rgba(11,30,61,.06)}.vehicles-editor h2,.vehicles-dialog h2{margin:0 0 6px;font-size:23px}.vehicles-switch{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #dce5ec;border-radius:999px;font-size:13px;font-weight:750}.vehicles-switch input{accent-color:#00a38f}.vehicles-core{display:grid;grid-template-columns:1fr 1.5fr 1fr;gap:14px;margin:24px 0}.vehicles-field{display:grid;gap:7px;font-size:13px;font-weight:750;color:#243a56}.vehicles-field>span{display:flex;justify-content:space-between;gap:8px}.vehicles-field small{color:#718197;font-size:11px;font-weight:650}.vehicles-field input,.vehicles-field select{box-sizing:border-box;width:100%;border:1px solid #ccd7e1;border-radius:8px;background:#fff;color:#0B1E3D;font:inherit;padding:10px 11px;outline:none}.vehicles-field input:focus,.vehicles-field select:focus{border-color:#00a38f;box-shadow:0 0 0 3px rgba(0,194,168,.12)}.vehicles-field input:disabled{background:#f2f5f7;color:#718197}.vehicles-region-picker{border-top:1px solid #e7edf1;border-bottom:1px solid #e7edf1;padding:22px 0;margin:4px 0 20px}.vehicles-region-picker h3{margin:0 0 5px;font-size:16px}.vehicles-region-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}.vehicles-region-option{display:flex;align-items:center;gap:9px;text-align:left;border:1px solid #d9e2e9;border-radius:10px;background:#fff;padding:11px;cursor:pointer;color:#0B1E3D}.vehicles-region-option.selected{border-color:#00a38f;background:rgba(0,194,168,.06)}.vehicles-check{display:grid;place-items:center;flex:0 0 19px;width:19px;height:19px;border:1px solid #b6c5d0;border-radius:50%;color:#fff}.selected .vehicles-check{border-color:#00a38f;background:#00a38f}.vehicles-region-option strong,.vehicles-region-option small{display:block}.vehicles-region-option small{margin-top:2px;color:#718197;font-size:11px}.vehicles-region-configs{display:grid;gap:12px}.vehicles-region-card{border:1px solid #dce5ec;border-radius:12px;overflow:hidden}.vehicles-region-card summary{display:flex;align-items:center;justify-content:space-between;cursor:pointer;list-style:none;padding:15px 16px;background:#fbfcfd}.vehicles-region-card summary::-webkit-details-marker{display:none}.vehicles-region-card summary strong,.vehicles-region-card summary small{display:block}.vehicles-region-card summary small{margin-top:3px;color:#718197;font-size:12px}.vehicles-region-card summary svg{transition:transform .18s}.vehicles-region-card[open] summary svg{transform:rotate(180deg)}.vehicles-region-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;padding:18px 16px}.vehicles-editor footer{margin-top:22px;justify-content:flex-start}.vehicles-empty{margin:0;padding:28px;border:1px dashed #cad6df;border-radius:12px;text-align:center;color:#657588}.vehicles-alert{margin:0;padding:11px 13px;border:1px solid #fecaca;border-radius:10px;background:#fff1f2;color:#b42318}.vehicles-dialog{position:fixed;z-index:100;left:50%;top:50%;width:min(420px,calc(100vw - 32px));transform:translate(-50%,-50%);box-shadow:0 24px 60px rgba(11,30,61,.28)}.vehicles-dialog p{color:#657588}.vehicles-dialog>div{display:flex;gap:10px;margin-top:20px}.vehicles-danger{background:#b42318;color:white}.vehicles-skeleton{display:grid;gap:1px;overflow:hidden;border:1px solid #e2e8ee;border-radius:14px}.vehicles-skeleton div{height:58px;background:linear-gradient(90deg,#f2f5f7 25%,#fbfcfd 37%,#f2f5f7 63%);background-size:400% 100%;animation:vehicles-shimmer 1.2s infinite}.vehicles-skeleton div:first-child{height:42px}@keyframes vehicles-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}@media(max-width:760px){.vehicles-toolbar,.vehicles-editor header{align-items:flex-start;flex-direction:column}.vehicles-core,.vehicles-region-options,.vehicles-region-fields{grid-template-columns:1fr}.vehicles-editor{padding:18px}.vehicles-actions{white-space:nowrap}}
`;
