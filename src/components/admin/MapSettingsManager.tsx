"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Map as MapIcon,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { MapSearchProvider } from "@/lib/MapSearchContext";
import { OSM_THEMES, type MapSettings } from "@/lib/config/mapSettings";
import { REGION_LIST, type RegionCode } from "@/lib/config/regions";
import AddressInput from "@/components/landing/AddressInput";
import OsmMapCanvas from "@/components/map/OsmMapCanvas";
import GoogleMapCanvas from "@/components/map/GoogleMapCanvas";
import { MAP_STYLE } from "@/lib/googleMapsStyle";

const field: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "0 12px",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  color: "var(--color-primary)",
  background: "var(--color-panel)",
  font: "inherit",
};

type ZoneOption = { id: string; name: string };
type PreviewStation = {
  objectId: number;
  name: string;
  lat: number;
  lng: number;
  active: boolean;
};
type ActiveDataset = {
  version: number;
  stationCount: number;
  file?: { originalName?: string };
};
type GoogleMapLike = object;
type GoogleMarkerLike = {
  addListener: (
    event: string,
    callback: (event: {
      latLng: { lat: () => number; lng: () => number } | null;
    }) => void,
  ) => void;
  setMap: (map: GoogleMapLike | null) => void;
};
type GoogleMapsApi = {
  maps: {
    Marker: new (options: {
      map: GoogleMapLike;
      position: { lat: number; lng: number };
      title: string;
      draggable: boolean;
      label: {
        text: string;
        color: string;
        fontSize: string;
        fontWeight: string;
      };
    }) => GoogleMarkerLike;
  };
};

export default function MapSettingsManager() {
  const [regionCode, setRegionCode] = useState<RegionCode>("EG-CAIRO");
  const [settings, setSettings] = useState<MapSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [zoneOptions, setZoneOptions] = useState<ZoneOption[]>([]);
  const [stationPreview, setStationPreview] = useState<{
    regionCode: RegionCode;
    stations: PreviewStation[];
    activeDataset: ActiveDataset | null;
  } | null>(null);
  const previewStations =
    stationPreview?.regionCode === regionCode ? stationPreview.stations : [];
  const activeDataset =
    stationPreview?.regionCode === regionCode
      ? stationPreview.activeDataset
      : null;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/admin/stations?region=${regionCode}&active=true&limit=all`),
      fetch(`/api/admin/station-operations/summary?region=${regionCode}`),
    ])
      .then(async ([stationsResponse, summaryResponse]) => {
        const [stationsJson, summaryJson] = await Promise.all([
          stationsResponse.json(),
          summaryResponse.json(),
        ]);
        if (!stationsResponse.ok)
          throw new Error(stationsJson.error ?? "Could not load stations.");
        if (!summaryResponse.ok)
          throw new Error(
            summaryJson.error ?? "Could not load station dataset status.",
          );
        return { stationsJson, summaryJson };
      })
      .then(({ stationsJson, summaryJson }) => {
        if (cancelled) return;
        setStationPreview({
          regionCode,
          stations: stationsJson.stations ?? [],
          activeDataset: summaryJson.activeDataset ?? null,
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(
            error instanceof Error ? error.message : "Could not load stations.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [regionCode]);

  useEffect(() => {
    if (regionCode !== "EG-CAIRO") return;
    let cancelled = false;
    fetch("/geo/zone_polygon.geojson")
      .then((response) => response.json())
      .then(
        (geojson: {
          features?: Array<{
            id?: string | number;
            properties?: { NAME?: string };
          }>;
        }) => {
          if (cancelled) return;
          setZoneOptions(
            (geojson.features ?? [])
              .filter((feature) => feature.id != null)
              .map((feature) => ({
                id: String(feature.id),
                name: feature.properties?.NAME || String(feature.id),
              })),
          );
        },
      )
      .catch(() => {
        if (!cancelled) setMessage("Could not load the service-zone list.");
      });
    return () => {
      cancelled = true;
    };
  }, [regionCode]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/maps?regionCode=${regionCode}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setSettings(json.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setMessage("Could not load map settings.");
      });
    return () => {
      cancelled = true;
    };
  }, [regionCode]);
  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/maps", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setSettings(json.data);
      setMessage(
        "Map configuration saved. New /create visits use this provider.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save map settings.",
      );
    } finally {
      setSaving(false);
    }
  }
  const set = <K extends keyof MapSettings>(key: K, value: MapSettings[K]) =>
    setSettings((current) =>
      current ? { ...current, [key]: value } : current,
    );

  async function moveStation(objectId: number, lat: number, lng: number) {
    const previous = previewStations.find(
      (station) => station.objectId === objectId,
    );
    if (!previous) return;
    setStationPreview((current) =>
      current?.regionCode === regionCode
        ? {
            ...current,
            stations: current.stations.map((station) =>
              station.objectId === objectId
                ? { ...station, lat, lng }
                : station,
            ),
          }
        : current,
    );
    try {
      const response = await fetch(
        `/api/stations/${objectId}?region=${encodeURIComponent(regionCode)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng }),
        },
      );
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error ?? "Could not move station.");
      setMessage(`Station #${objectId} location saved for this region.`);
    } catch (error) {
      setStationPreview((current) =>
        current?.regionCode === regionCode
          ? {
              ...current,
              stations: current.stations.map((station) =>
                station.objectId === objectId
                  ? { ...station, lat: previous.lat, lng: previous.lng }
                  : station,
              ),
            }
          : current,
      );
      setMessage(
        error instanceof Error ? error.message : "Could not move station.",
      );
    }
  }
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="map-settings-card">
        <div>
          <p className="map-settings-kicker">Region configuration</p>
          <h2>Map provider and presentation</h2>
          <p>
            One provider is active per region. Stations and service-zone
            controls are applied to the rider map.
          </p>
        </div>
        <label>
          <span>Region</span>
          <select
            value={regionCode}
            onChange={(event) =>
              setRegionCode(event.target.value as RegionCode)
            }
            style={field}
          >
            {REGION_LIST.map((region) => (
              <option key={region.code} value={region.code}>
                {region.label}
              </option>
            ))}
          </select>
        </label>
      </section>
      {settings?.regionCode === regionCode ? (
        <>
          <section className="map-settings-grid">
            <ProviderOption
              active={settings.provider === "google"}
              title="Google Maps"
              description="Interactive Google canvas with Google Places search."
              onClick={() => set("provider", "google")}
            />
            <ProviderOption
              active={settings.provider === "osm"}
              title="OpenStreetMap"
              description="Leaflet canvas with the OSM/Nominatim search path."
              onClick={() => set("provider", "osm")}
            />
          </section>

          <section className="map-settings-card">
            <div>
              <p className="map-settings-kicker">
                <SlidersHorizontal size={14} /> Live template
              </p>
              <h2>Map preset and service-zone state</h2>
            </div>

            <div className="map-settings-options">
              <label>
                <span>Canvas style</span>
                <select
                  value={settings.canvasStyle}
                  disabled={settings.provider !== "google"}
                  onChange={(event) =>
                    set(
                      "canvasStyle",
                      event.target.value as MapSettings["canvasStyle"],
                    )
                  }
                  style={field}
                >
                  <option value="roadmap">Roadmap</option>
                  <option value="satellite">Satellite</option>
                  <option value="light">Light branded map</option>
                </select>
              </label>

              {settings.provider === "osm" && (
                <label>
                  <span>OSM theme</span>
                  <select
                    value={settings.osmTheme}
                    onChange={(event) =>
                      set(
                        "osmTheme",
                        event.target.value as MapSettings["osmTheme"],
                      )
                    }
                    style={field}
                  >
                    {Object.entries(OSM_THEMES).map(([value, theme]) => (
                      <option key={value} value={value}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <Toggle
                label="Show station markers"
                checked={settings.showStations}
                onChange={(value) => set("showStations", value)}
              />
            </div>

            <div className="map-settings-option-row" style={{ marginTop: 16 }}>
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  padding: "14px 16px",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  background: "rgba(0, 194, 168, 0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ color: "var(--color-primary)" }}>
                    {REGION_LIST.find((item) => item.code === regionCode)
                      ?.label ?? regionCode}
                  </strong>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      minHeight: 24,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background:
                        regionCode === "EG-CAIRO" && zoneOptions.length > 0
                          ? "rgba(0, 194, 168, 0.1)"
                          : "rgba(11, 30, 61, 0.06)",
                      color:
                        regionCode === "EG-CAIRO" && zoneOptions.length > 0
                          ? "#00897B"
                          : "var(--color-muted)",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {regionCode === "EG-CAIRO" && zoneOptions.length > 0
                      ? `${zoneOptions.length} zone polygons active`
                      : "No zone polygon"}
                  </span>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <label
                    className="map-settings-toggle"
                    style={{ width: "100%" }}
                  >
                    <span>Border</span>
                    <select
                      value={
                        settings.showZones && regionCode === "EG-CAIRO"
                          ? "enabled"
                          : "disabled"
                      }
                      disabled={regionCode !== "EG-CAIRO"}
                      style={field}
                      onChange={(event) =>
                        set("showZones", event.target.value === "enabled")
                      }
                    >
                      <option value="enabled">Enabled</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </label>

                  <label
                    className="map-settings-toggle"
                    style={{ width: "100%" }}
                  >
                    <span>Labels</span>
                    <select
                      value={settings.showZoneLabels ? "visible" : "hidden"}
                      disabled={
                        !settings.showZones || regionCode !== "EG-CAIRO"
                      }
                      style={field}
                      onChange={(event) =>
                        set("showZoneLabels", event.target.value === "visible")
                      }
                    >
                      <option value="visible">Visible</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </label>

                  <label
                    className="map-settings-toggle"
                    style={{ width: "100%" }}
                  >
                    <span>Outside mask</span>
                    <select
                      value={settings.maskOutsideZones ? "on" : "off"}
                      disabled={
                        !settings.showZones || regionCode !== "EG-CAIRO"
                      }
                      style={field}
                      onChange={(event) =>
                        set("maskOutsideZones", event.target.value === "on")
                      }
                    >
                      <option value="on">On</option>
                      <option value="off">Off</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <p className="map-settings-note">
              Canvas styles only change the Google map skin. OSM uses the
              selected theme for border, labels, and service-zone styling. Zone
              overlays are only active where the polygon dataset exists.
            </p>
          </section>

          <section className="map-settings-card">
            <div>
              <p className="map-settings-kicker">Station assignment</p>
              <h2>Choose how locations use stations</h2>
              <p>
                Keep the existing vehicle-based behavior, or choose station
                behavior by Cairo zone.
              </p>
            </div>
            <div className="map-settings-grid">
              <ProviderOption
                active={settings.stationAssignmentMode === "shared-vehicles"}
                title="Shared vehicles"
                description="Shared vehicle types use nearby stations; other vehicles use the selected points directly."
                onClick={() => set("stationAssignmentMode", "shared-vehicles")}
              />
              <ProviderOption
                active={settings.stationAssignmentMode === "zones"}
                title="Zones"
                description="Each configured station zone uses nearby stations. Other locations use their selected points directly."
                onClick={() => set("stationAssignmentMode", "zones")}
              />
            </div>
            {regionCode === "EG-CAIRO" &&
              settings.stationAssignmentMode === "zones" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <p className="map-settings-note">
                    Add each zone to one list. Zones not assigned to either list
                    use the selected point directly. Zone assignments are
                    exclusive.
                  </p>
                  <div className="map-settings-grid">
                    <ZoneListEditor
                      title="Use selected point directly"
                      zoneOptions={zoneOptions}
                      zoneIds={settings.directPointZoneIds}
                      assignedIds={[
                        ...settings.directPointZoneIds,
                        ...settings.stationZoneIds,
                      ]}
                      onAdd={(zoneId) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                directPointZoneIds: [
                                  ...current.directPointZoneIds,
                                  zoneId,
                                ],
                                stationZoneIds: current.stationZoneIds.filter(
                                  (id) => id !== zoneId,
                                ),
                              }
                            : current,
                        )
                      }
                      onRemove={(zoneId) =>
                        set(
                          "directPointZoneIds",
                          settings.directPointZoneIds.filter(
                            (id) => id !== zoneId,
                          ),
                        )
                      }
                    />
                    <ZoneListEditor
                      title="Suggest nearby stations"
                      zoneOptions={zoneOptions}
                      zoneIds={settings.stationZoneIds}
                      assignedIds={[
                        ...settings.directPointZoneIds,
                        ...settings.stationZoneIds,
                      ]}
                      onAdd={(zoneId) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                stationZoneIds: [
                                  ...current.stationZoneIds,
                                  zoneId,
                                ],
                                directPointZoneIds:
                                  current.directPointZoneIds.filter(
                                    (id) => id !== zoneId,
                                  ),
                              }
                            : current,
                        )
                      }
                      onRemove={(zoneId) =>
                        set(
                          "stationZoneIds",
                          settings.stationZoneIds.filter((id) => id !== zoneId),
                        )
                      }
                    />
                  </div>
                </div>
              )}
            {regionCode !== "EG-CAIRO" &&
              settings.stationAssignmentMode === "zones" && (
                <p className="map-settings-note">
                  Zone-based station assignment is available for Cairo, where
                  the zone dataset is configured.
                </p>
              )}
          </section>

          <section className="map-settings-preview">
            <div className="map-demo-copy">
              <p className="map-settings-kicker">
                <MapIcon size={14} /> Live preview
              </p>
              <h2>Preview the active map configuration</h2>
              <p>
                This map reflects the currently selected provider, canvas/theme,
                and service-zone toggles in real time.
              </p>
              <p className="map-settings-note">
                {previewStations.length
                  ? `${previewStations.length} active station markers loaded for ${REGION_LIST.find((item) => item.code === regionCode)?.label}${activeDataset ? ` · dataset v${activeDataset.version}${activeDataset.file?.originalName ? ` (${activeDataset.file.originalName})` : ""}` : ""}. Drag a marker to move it; the location is saved as a station override.`
                  : `No active station markers are loaded for this region${activeDataset ? `, although dataset v${activeDataset.version} is published` : " and no station dataset is published"}.`}{" "}
                <a
                  href={`/${REGION_LIST.find((item) => item.code === regionCode)?.urlSlug}/admin/operation`}
                >
                  Manage this region’s station dataset
                </a>
              </p>
              <MapSearchProvider provider={settings.provider}>
                <SearchDemo />
              </MapSearchProvider>
            </div>
            <MapCanvas
              key={`${settings.provider}-${settings.canvasStyle}-${settings.osmTheme}-${settings.showZones}-${settings.showZoneLabels}-${settings.maskOutsideZones}-${settings.showStations}-${regionCode}`}
              provider={settings.provider}
              style={settings.canvasStyle}
              osmTheme={settings.osmTheme}
              regionCode={regionCode}
              settings={settings}
              stations={settings.showStations ? previewStations : []}
              onStationMove={moveStation}
            />
          </section>
          <section className="map-settings-card map-settings-info">
            <div>
              <p className="map-settings-kicker">Info</p>
              <h2>Requests, costs, and operating limits</h2>
            </div>
            <div className="map-info-grid">
              <p>
                <strong>Google Maps</strong> (global list, first paid tier): the
                first 10,000 monthly Dynamic Maps loads are free, then
                US$7/1,000; Places autocomplete requests are US$2.83/1,000 after
                10,000 free; Place Details Essentials (the selected result) is
                US$5/1,000 after 10,000 free. Google tiers and account pricing
                can change.
              </p>
              <p>
                <strong>OpenStreetMap</strong> map data is open, but the public
                tile and Nominatim services are best-effort shared
                infrastructure, not a commercial SLA. Normal interactive use,
                attribution, and cache-friendly requests are required; move
                production volume to a managed or self-hosted provider when
                needed.
              </p>
              <p>
                <strong>Search fields</strong> always use the selected provider.
                The browser only receives the public Google map key; Places and
                reverse-geocoding calls run through the server with the private
                key. This app’s route calculation remains on its existing route
                service.
              </p>
            </div>
          </section>
          <button
            type="button"
            className="map-settings-save"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save map configuration"}
          </button>
          {message ? (
            <p role="status" className="map-settings-message">
              {message}
            </p>
          ) : null}
        </>
      ) : (
        <p className="map-settings-message">Loading map configuration…</p>
      )}
    </div>
  );
}

function ZoneListEditor({
  title,
  zoneOptions,
  zoneIds,
  assignedIds,
  onAdd,
  onRemove,
}: {
  title: string;
  zoneOptions: ZoneOption[];
  zoneIds: string[];
  assignedIds: string[];
  onAdd: (zoneId: string) => void;
  onRemove: (zoneId: string) => void;
}) {
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const availableOptions = zoneOptions.filter(
    (zone) => !assignedIds.includes(zone.id),
  );
  const labelId = `zone-list-${title.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <section
      aria-labelledby={labelId}
      style={{
        display: "grid",
        alignContent: "start",
        gap: 12,
        padding: 16,
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        background: "var(--color-panel)",
      }}
    >
      <h3 id={labelId} style={{ margin: 0, color: "var(--color-primary)" }}>
        {title} <span>({zoneIds.length})</span>
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
        <select
          aria-label={`Select zone for ${title}`}
          value={selectedZoneId}
          disabled={!availableOptions.length}
          onChange={(event) => setSelectedZoneId(event.target.value)}
          style={field}
        >
          <option value="">
            {availableOptions.length ? "Choose a zone…" : "All zones assigned"}
          </option>
          {availableOptions.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.id} — {zone.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={`Add zone to ${title}`}
          disabled={!selectedZoneId}
          onClick={() => {
            onAdd(selectedZoneId);
            setSelectedZoneId("");
          }}
          style={{
            ...field,
            width: 48,
            padding: 0,
            display: "grid",
            placeItems: "center",
            cursor: selectedZoneId ? "pointer" : "not-allowed",
          }}
        >
          <Plus size={18} />
        </button>
      </div>
      {zoneIds.length ? (
        <ul
          style={{
            display: "grid",
            gap: 8,
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {zoneIds.map((zoneId) => {
            const zone = zoneOptions.find((option) => option.id === zoneId);
            return (
              <li
                key={zoneId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "rgba(11, 30, 61, 0.04)",
                  color: "var(--color-primary)",
                  fontSize: 13,
                }}
              >
                <span>
                  <strong>{zoneId}</strong>
                  {zone ? ` — ${zone.name}` : ""}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${zoneId} from ${title}`}
                  onClick={() => onRemove(zoneId)}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "var(--color-muted)",
                    cursor: "pointer",
                    minWidth: 36,
                    minHeight: 36,
                  }}
                >
                  <X size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="map-settings-note" style={{ margin: 0 }}>
          No zones assigned.
        </p>
      )}
    </section>
  );
}

function ProviderOption({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`map-provider-option${active ? " is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="map-provider-check">
        {active ? <Check size={16} /> : null}
      </span>
      <strong>{title}</strong>
      <small>{description}</small>
    </button>
  );
}
function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="map-settings-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
function SearchDemo() {
  const [point, setPoint] = useState<{
    address: string;
    lat: number;
    lng: number;
  } | null>(null);
  return (
    <div className="map-search-demo">
      <AddressInput
        id="map-search-demo"
        label="Pickup or destination"
        placeholder="Search an address"
        value={point}
        onChange={setPoint}
      />
      <span>
        {point
          ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
          : "Choose a result to validate this provider."}
      </span>
    </div>
  );
}
function MapCanvas({
  provider,
  style,
  regionCode,
  osmTheme,
  settings,
  stations,
  onStationMove,
}: {
  provider: MapSettings["provider"];
  style: MapSettings["canvasStyle"];
  regionCode: RegionCode;
  osmTheme: MapSettings["osmTheme"];
  settings: MapSettings;
  stations: PreviewStation[];
  onStationMove: (objectId: number, lat: number, lng: number) => void;
}) {
  const [googleMap, setGoogleMap] = useState<GoogleMapLike | null>(null);
  useEffect(() => {
    const google = (window as Window & { google?: GoogleMapsApi }).google;
    if (provider !== "google" || !googleMap || !google?.maps?.Marker) return;

    const markers = stations.map((station) => {
      const marker = new google.maps.Marker({
        map: googleMap,
        position: { lat: station.lat, lng: station.lng },
        title: `#${station.objectId} ${station.name}`,
        draggable: true,
        label: {
          text: String(station.objectId),
          color: "#0B1E3D",
          fontSize: "10px",
          fontWeight: "700",
        },
      });
      marker.addListener("dragend", (event) => {
        if (event.latLng) {
          onStationMove(
            station.objectId,
            event.latLng.lat(),
            event.latLng.lng(),
          );
        }
      });
      return marker;
    });
    return () => markers.forEach((marker) => marker.setMap(null));
  }, [googleMap, onStationMove, provider, stations]);

  const region = REGION_LIST.find((item) => item.code === regionCode)!;
  if (provider === "osm")
    return (
      <div className="map-demo-canvas">
        <OsmMapCanvas
          center={region.map.defaultCenter}
          zoom={region.map.defaultZoom}
          theme={osmTheme}
          zoneSettings={{
            showZones: settings.showZones,
            showZoneLabels: settings.showZoneLabels,
            maskOutsideZones: settings.maskOutsideZones,
            regionCode,
          }}
          stations={stations}
          onStationMove={onStationMove}
        />
      </div>
    );
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
    return (
      <div className="map-demo-canvas map-demo-unavailable">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to preview Google Maps.
      </div>
    );
  return (
    <div className="map-demo-canvas">
      <GoogleMapCanvas
        center={region.map.defaultCenter}
        zoom={region.map.defaultZoom}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeId: style === "satellite" ? "satellite" : "roadmap",
          styles: style === "light" ? MAP_STYLE : undefined,
        }}
        onReady={setGoogleMap}
      />
    </div>
  );
}
