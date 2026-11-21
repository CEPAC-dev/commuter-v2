"use client";

import { useCallback, useEffect, useState } from "react";
import type { RegionCode } from "@/lib/config/regions";

interface City {
  cityCode: string;
  regionCode: RegionCode;
  name: string;
  nameAr: string;
  isCapital: boolean;
  active: boolean;
  timezone: string;
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
  zoneFeatures: unknown[];
}

const fieldStyle: React.CSSProperties = {
  minWidth: 0,
  height: 42,
  padding: "0 12px",
  border: "1px solid #d6dde5",
  borderRadius: 8,
  background: "#fff",
  color: "#0B1E3D",
  font: "inherit",
};

export default function RegionsManager({
  regionCode,
  regionLabel,
}: {
  regionCode: RegionCode;
  regionLabel: string;
}) {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [cityCode, setCityCode] = useState("");
  const [timezone, setTimezone] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [zoneCityCode, setZoneCityCode] = useState("");
  const [zoneJson, setZoneJson] = useState("");

  const loadCities = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/cities?regionCode=${encodeURIComponent(regionCode)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load cities.");
      setCities(data.cities);
      if (zoneCityCode) {
        const selected = data.cities.find(
          (city: City) => city.cityCode === zoneCityCode,
        );
        if (selected) setZoneJson(JSON.stringify(selected.zoneFeatures ?? [], null, 2));
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load cities.",
      );
    } finally {
      setLoading(false);
    }
  }, [regionCode, zoneCityCode]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/cities?regionCode=${encodeURIComponent(regionCode)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load cities.");
        if (!cancelled) setCities(data.cities);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load cities.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [regionCode]);

  async function addCity(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionCode,
          name,
          nameAr,
          cityCode,
          timezone,
          lat: Number(lat),
          lng: Number(lng),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not add city.");
      setName("");
      setNameAr("");
      setCityCode("");
      setTimezone("");
      setLat("");
      setLng("");
      await loadCities();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not add city.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleCity(city: City) {
    setError("");
    try {
      const response = await fetch(
        `/api/admin/cities/${encodeURIComponent(city.cityCode)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regionCode, active: !city.active }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update city.");
      await loadCities();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update city.",
      );
    }
  }

  async function saveZones(event: React.FormEvent) {
    event.preventDefault();
    const city = cities.find((item) => item.cityCode === zoneCityCode);
    if (!city) return;
    let zoneFeatures: unknown;
    try {
      zoneFeatures = JSON.parse(zoneJson);
    } catch {
      setError("Service zones must be valid JSON.");
      return;
    }
    setError("");
    try {
      const response = await fetch(
        `/api/admin/cities/${encodeURIComponent(city.cityCode)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regionCode, zoneFeatures }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save zones.");
      await loadCities();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save zones.",
      );
    }
  }

  return (
    <main style={{ display: "grid", gap: 20, maxWidth: 1000 }}>
      <header>
        <h1 style={{ margin: 0, color: "#0B1E3D" }}>Regions and City/State</h1>
        <p style={{ color: "#5A6A7A" }}>
          {regionLabel} · Currency remains configured at the Region level.
        </p>
      </header>
      {error && (
        <p role="alert" style={{ color: "#b42318", margin: 0 }}>
          {error}
        </p>
      )}
      <section
        style={{
          display: "grid",
          gap: 14,
          padding: 20,
          border: "1px solid #e3e8ee",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <h2 style={{ margin: 0, color: "#0B1E3D", fontSize: 18 }}>
          Operating City/State areas
        </h2>
        {loading ? (
          <p>Loading operating areas…</p>
        ) : cities.length ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {cities.map((city) => (
              <li
                key={city.cityCode}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  padding: 12,
                  border: "1px solid #e3e8ee",
                  borderRadius: 8,
                }}
              >
                <span>
                  <strong>{city.name}</strong> ({city.nameAr}) · {city.timezone}
                  {city.isCapital ? " · Capital" : ""}
                  {!city.active ? " · Inactive" : ""}
                </span>
                <span style={{ display: "flex", gap: 8 }}>
                  {!city.isCapital && (
                    <button
                      type="button"
                      onClick={() => void toggleCity(city)}
                      style={{
                        ...fieldStyle,
                        cursor: "pointer",
                        color: city.active ? "#b42318" : "#00877A",
                      }}
                    >
                      {city.active ? "Deactivate" : "Activate"}
                    </button>
                  )}
                  {!city.isCapital && (
                    <button
                      type="button"
                      onClick={() => {
                        setZoneCityCode(city.cityCode);
                        setZoneJson(JSON.stringify(city.zoneFeatures ?? [], null, 2));
                      }}
                      style={{ ...fieldStyle, cursor: "pointer" }}
                    >
                      Configure zones
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No operating areas are configured.</p>
        )}
      </section>
      {zoneCityCode && (
        <form
          onSubmit={saveZones}
          style={{
            display: "grid",
            gap: 12,
            padding: 20,
            border: "1px solid #e3e8ee",
            borderRadius: 12,
            background: "#fff",
          }}
        >
          <h2 style={{ margin: 0, color: "#0B1E3D", fontSize: 18 }}>
            Service zones — {cities.find((city) => city.cityCode === zoneCityCode)?.name}
          </h2>
          <p style={{ margin: 0, color: "#5A6A7A" }}>
            Paste a JSON array of GeoJSON Polygon or MultiPolygon Features.
            Add at least one station in the Stations page before activating this area.
          </p>
          <textarea
            required
            value={zoneJson}
            onChange={(event) => setZoneJson(event.target.value)}
            rows={12}
            aria-label="City service zones GeoJSON"
            style={{ ...fieldStyle, height: "auto", padding: 12, fontFamily: "monospace" }}
          />
          <button type="submit" style={{ ...fieldStyle, width: "fit-content", cursor: "pointer" }}>
            Save service zones
          </button>
        </form>
      )}
      <form
        onSubmit={addCity}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          padding: 20,
          border: "1px solid #e3e8ee",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <h2 style={{ gridColumn: "1 / -1", margin: 0, color: "#0B1E3D", fontSize: 18 }}>
          Add City/State
        </h2>
        <input required aria-label="City/State name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
        <input required aria-label="Arabic City/State name" placeholder="Arabic name" value={nameAr} onChange={(e) => setNameAr(e.target.value)} style={fieldStyle} />
        <input required aria-label="City code" placeholder="Code (e.g. alexandria)" value={cityCode} onChange={(e) => setCityCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} style={fieldStyle} />
        <input required aria-label="IANA timezone" placeholder="Timezone (e.g. Africa/Cairo)" value={timezone} onChange={(e) => setTimezone(e.target.value)} style={fieldStyle} />
        <input required type="number" step="any" min="-90" max="90" aria-label="Map center latitude" placeholder="Map center latitude" value={lat} onChange={(e) => setLat(e.target.value)} style={fieldStyle} />
        <input required type="number" step="any" min="-180" max="180" aria-label="Map center longitude" placeholder="Map center longitude" value={lng} onChange={(e) => setLng(e.target.value)} style={fieldStyle} />
        <button
          type="submit"
          disabled={saving}
          style={{
            ...fieldStyle,
            background: "#0B1E3D",
            color: "#fff",
            border: 0,
            fontWeight: 700,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Add operating area"}
        </button>
      </form>
    </main>
  );
}
