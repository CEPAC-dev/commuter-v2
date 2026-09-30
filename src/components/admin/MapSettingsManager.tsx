"use client";

import { useEffect, useState } from "react";
import { Check, Map as MapIcon, Search, SlidersHorizontal } from "lucide-react";
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

export default function MapSettingsManager() {
  const [regionCode, setRegionCode] = useState<RegionCode>("EG-CAIRO");
  const [settings, setSettings] = useState<MapSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    setSettings(null);
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
      {settings ? (
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
                        regionCode === "EG-CAIRO"
                          ? "rgba(0, 194, 168, 0.1)"
                          : "rgba(11, 30, 61, 0.06)",
                      color:
                        regionCode === "EG-CAIRO"
                          ? "#00897B"
                          : "var(--color-muted)",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {regionCode === "EG-CAIRO"
                      ? "Polygon active"
                      : "No zone dataset"}
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
}: {
  provider: MapSettings["provider"];
  style: MapSettings["canvasStyle"];
  regionCode: RegionCode;
  osmTheme: MapSettings["osmTheme"];
  settings: MapSettings;
}) {
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
      />
    </div>
  );
}
