"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, MapPin, Search, X } from "lucide-react";
import AdminTripMap, { type TripMapPoint } from "@/components/admin/AdminTripMap";

export type AdminStationRow = {
  id: string;
  stopNumber: number;
  name: string;
  zone: string;
  direction: string;
  description: string;
  lat: number;
  lng: number;
  active: boolean;
};

export default function StationsClient({
  stations,
}: {
  stations: AdminStationRow[];
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const filteredStations = useMemo(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return stations;
    // pure-digit query matches the stop number exactly ("7" never matches 71 or 707)
    if (/^\d+$/.test(normalizedQuery)) {
      const exactNumber = Number(normalizedQuery);
      return stations.filter((station) => station.stopNumber === exactNumber);
    }
    const lowerQuery = normalizedQuery.toLowerCase();
    return stations.filter((station) =>
      [station.name, station.zone, station.direction, station.description].some(
        (value) => value.toLowerCase().includes(lowerQuery),
      ),
    );
  }, [query, stations]);

  const selectedStation =
    stations.find((station) => station.id === selectedId) ?? null;
  const mapPoints = useMemo<TripMapPoint[]>(
    () =>
      selectedStation
        ? [
            {
              lat: selectedStation.lat,
              lng: selectedStation.lng,
              label: `Stop ${selectedStation.stopNumber}${selectedStation.name ? `: ${selectedStation.name}` : ""}`,
              kind: "station",
              order: selectedStation.stopNumber,
            },
          ]
        : [],
    [selectedStation],
  );
  const selectedStationGoogleMapsUrl = selectedStation
    ? `https://www.google.com/maps/search/?api=1&query=${selectedStation.lat},${selectedStation.lng}`
    : null;

  useEffect(() => {
    if (!selectedId) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") selectStation(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedId]);

  function selectStation(id: string | null) {
    setSelectedId(id);
    setCopied(false);
  }

  async function copyCoordinates() {
    if (!selectedStation) return;
    const text = `${selectedStation.lat}, ${selectedStation.lng}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard permission denied or unavailable — no-op
    }
  }

  return (
    <div className="stations-page">
      <style>{`
        .stations-panel {
          min-width: 0;
          overflow: hidden;
          background: var(--color-panel);
          border: 1px solid var(--color-border);
          border-top: 3px solid var(--color-secondary);
          border-radius: var(--radius-md);
          box-shadow: 0 10px 32px var(--color-shadow);
        }
        .stations-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--color-border);
        }
        .stations-toolbar-title {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
          color: var(--color-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .stations-search {
          display: flex;
          align-items: center;
          gap: 8px;
          width: min(420px, 100%);
          padding: 9px 12px;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          color: var(--color-muted);
        }
        .stations-search:focus-within { border-color: var(--color-secondary); }
        .stations-search input {
          min-width: 0;
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--color-primary);
          font: inherit;
          font-size: 13px;
        }
        .stations-table-wrap { overflow: auto; max-height: 70vh; }
        .stations-table { width: 100%; border-collapse: collapse; }
        .stations-table th {
          position: sticky;
          top: 0;
          z-index: 1;
          padding: 11px 13px;
          text-align: left;
          white-space: nowrap;
          background: var(--color-background);
          border-bottom: 1px solid var(--color-border);
          color: var(--color-muted);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .stations-table td {
          padding: 12px 13px;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-primary);
          font-size: 13px;
          vertical-align: top;
        }
        .stations-table tr:last-child td { border-bottom: 0; }
        .stations-table tbody tr { cursor: pointer; }
        .stations-table tbody tr:hover,
        .stations-table tbody tr.selected { background: var(--color-secondary-tint); }
        .stations-table tbody tr:focus-visible {
          outline: 2px solid var(--color-secondary);
          outline-offset: -2px;
        }
        .stations-number { font-weight: 800; color: var(--color-secondary-deep); }
        .stations-coord { white-space: nowrap; font-variant-numeric: tabular-nums; }
        .stations-muted { color: var(--color-muted); }
        .stations-map-title { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: var(--color-primary); }
        .stations-map-meta { margin: 0 0 14px; color: var(--color-muted); font-size: 13px; }
        .stations-gmaps-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 14px;
          border: 0;
          border-radius: var(--radius-sm);
          background: var(--color-secondary-tint);
          color: var(--color-secondary-deep);
          font-size: 13px;
          font-weight: 700;
          font-family: inherit;
          text-decoration: none;
          cursor: pointer;
          transition: opacity 0.12s ease;
        }
        .stations-gmaps-link:hover { opacity: 0.78; }
        .stations-modal-overlay {
          position: fixed;
          inset: 0;
          background: var(--color-overlay);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1200;
          animation: stationsFadeIn 0.15s ease;
        }
        .stations-modal-panel {
          width: 100%;
          max-width: 560px;
          background: var(--color-panel);
          border-radius: 18px;
          border-top: 3px solid var(--color-secondary);
          box-shadow: 0 20px 60px var(--color-shadow-strong);
          animation: stationsPanelIn 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
          overflow: hidden;
        }
        .stations-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 20px 22px 14px;
        }
        .stations-modal-close {
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--color-muted);
          padding: 4px;
          flex-shrink: 0;
        }
        .stations-modal-body { padding: 0 22px 22px; }
        @keyframes stationsFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes stationsPanelIn { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .stations-modal-overlay, .stations-modal-panel { animation: none; }
        }
        @media (max-width: 960px) {
          .stations-table-wrap { max-height: none; }
        }
      `}</style>

      <section className="stations-panel" aria-label="Stations list">
        <div className="stations-toolbar">
          <p className="stations-toolbar-title">
            <MapPin size={15} aria-hidden="true" /> All stations
          </p>
          <label className="stations-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by exact stop number or station name"
              aria-label="Search stations"
            />
          </label>
          <span className="stations-muted" style={{ marginInlineStart: "auto", fontSize: 12, whiteSpace: "nowrap" }}>
            {filteredStations.length} shown
          </span>
        </div>
        <div className="stations-table-wrap">
          <table className="stations-table">
            <thead>
              <tr>
                <th>Stop</th>
                <th>Lat</th>
                <th>Long</th>
                <th>Stop name</th>
                <th>Zone</th>
                <th>Direction</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredStations.length ? (
                filteredStations.map((station) => (
                  <tr
                    key={station.id}
                    className={selectedId === station.id ? "selected" : undefined}
                    tabIndex={0}
                    aria-label={`Show stop ${station.stopNumber} on map`}
                    onClick={() => selectStation(station.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectStation(station.id);
                      }
                    }}
                  >
                    <td className="stations-number">{station.stopNumber}</td>
                    <td className="stations-coord">{station.lat.toFixed(6)}</td>
                    <td className="stations-coord">{station.lng.toFixed(6)}</td>
                    <td>{station.name || "—"}</td>
                    <td>{station.zone || "—"}</td>
                    <td>{station.direction || "—"}</td>
                    <td>{station.description || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--color-muted)" }}>
                    No stations match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedStation ? (
        <div
          className="stations-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) selectStation(null);
          }}
        >
          <div
            className="stations-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Stop ${selectedStation.stopNumber} location`}
          >
            <div className="stations-modal-header">
              <div>
                <h2 className="stations-map-title">
                  Stop {selectedStation.stopNumber}
                </h2>
                <p className="stations-map-meta" style={{ margin: "4px 0 0" }}>
                  {selectedStation.name || "Unnamed station"} · {selectedStation.lat.toFixed(6)}, {selectedStation.lng.toFixed(6)}
                </p>
              </div>
              <button
                type="button"
                className="stations-modal-close"
                onClick={() => selectStation(null)}
                aria-label="Close station map"
              >
                <X size={20} />
              </button>
            </div>
            <div className="stations-modal-body">
              <AdminTripMap key={selectedStation.id} points={mapPoints} />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <button
                  type="button"
                  className="stations-gmaps-link"
                  onClick={() => void copyCoordinates()}
                >
                  {copied ? (
                    <>
                      <Check size={14} aria-hidden="true" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={14} aria-hidden="true" /> Copy lat, lng
                    </>
                  )}
                </button>
                {selectedStationGoogleMapsUrl ? (
                  <a
                    href={selectedStationGoogleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="stations-gmaps-link"
                  >
                    <ExternalLink size={14} aria-hidden="true" /> Open in Google Maps
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}