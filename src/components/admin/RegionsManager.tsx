"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Globe2,
  LoaderCircle,
  MapPinned,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { REGIONS, type RegionCode } from "@/lib/config/regions";
import RegionCityCenterMap from "@/components/admin/RegionCityCenterMap";

const fieldClassName =
  "h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 text-sm text-[var(--color-primary)] shadow-sm transition placeholder:text-slate-400 focus:border-[var(--color-secondary)] focus:outline-none focus:ring-4 focus:ring-teal-500/15";
const labelClassName = "grid min-w-0 gap-1.5 text-sm font-semibold text-[var(--color-primary)]";
const secondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 text-sm font-semibold text-[var(--color-primary)] transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60";

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

export default function RegionsManager({
  regionCode,
  regionLabel,
}: {
  regionCode: RegionCode;
  regionLabel: string;
}) {
  const regionTimezone = REGIONS[regionCode].timezone;
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingZones, setSavingZones] = useState(false);
  const [updatingCityCode, setUpdatingCityCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [cityCode, setCityCode] = useState("");
  const [timezone, setTimezone] = useState(regionTimezone);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [zoneCityCode, setZoneCityCode] = useState("");
  const [zoneJson, setZoneJson] = useState("");

  const latitude = lat.trim() ? Number(lat) : Number.NaN;
  const longitude = lng.trim() ? Number(lng) : Number.NaN;
  const mapPoint =
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
      ? { lat: latitude, lng: longitude }
      : null;

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
        if (cancelled) return;
        setCities(data.cities);
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
    setSuccess("");
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
      const createdCode =
        typeof data.city?.cityCode === "string"
          ? data.city.cityCode
          : cityCode;
      setSuccess(`${name} was added with code ${createdCode}.`);
      setName("");
      setNameAr("");
      setCityCode("");
      setTimezone(regionTimezone);
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
    setSuccess("");
    setUpdatingCityCode(city.cityCode);
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
      setSuccess(`${city.name} is now ${city.active ? "inactive" : "active"}.`);
      await loadCities();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update city.",
      );
    } finally {
      setUpdatingCityCode("");
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
    setSuccess("");
    setSavingZones(true);
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
      setSuccess("Service zones saved.");
      await loadCities();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save zones.",
      );
    } finally {
      setSavingZones(false);
    }
  }

  return (
  <main className="mx-auto grid w-full max-w-7xl min-w-0 gap-6 px-3 py-5 sm:gap-7 sm:px-6 sm:py-8 lg:gap-8">
    <header className="flex flex-col justify-between gap-5 rounded-3xl bg-[var(--color-primary)] p-5 text-white shadow-sm sm:flex-row sm:items-center sm:p-7">
      <div className="min-w-0">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-teal-200">
          Operations / Region setup
        </p>
        <h1 className="m-0 text-2xl font-bold tracking-tight sm:text-3xl">
          Regions &amp; City/State
        </h1>
        <p className="mb-0 mt-2 max-w-2xl text-sm leading-6 text-white/75">
          Configure service areas and their map centers. Currency and vehicle
          availability remain managed at the Region level.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-bold ring-1 ring-white/15">
          <Globe2 size={16} aria-hidden="true" />
          {regionCode} · {regionLabel}
        </span>
        <span className="inline-flex min-h-10 items-center rounded-full bg-teal-300/15 px-4 text-sm font-semibold text-teal-100 ring-1 ring-teal-200/20">
          Currency: {REGIONS[regionCode].currency.code}
        </span>
      </div>
    </header>

    {error && (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="m-0">{error}</p>
      </div>
    )}
    {success && (
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
      >
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="m-0">{success}</p>
      </div>
    )}

    <section className="min-w-0 rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-secondary-tint)] text-[var(--color-primary)]">
            <Building2 size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 className="m-0 text-lg font-bold text-[var(--color-primary)]">
              Operating City/State areas
            </h2>
            <p className="mb-0 mt-1 text-sm leading-5 text-[var(--color-muted)]">
              Review service areas, status, and city-specific settings.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {loading ? "Loading…" : `${cities.length} ${cities.length === 1 ? "area" : "areas"}`}
        </span>
      </div>

      {loading ? (
        <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-[var(--color-muted)]" role="status">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          Loading operating areas…
        </div>
      ) : cities.length ? (
        <ul className="m-0 grid list-none gap-3 p-0">
          {cities.map((city) => (
            <li
              key={city.cityCode}
              className="flex min-w-0 flex-col justify-between gap-4 rounded-2xl border border-[var(--color-border)] p-4 sm:flex-row sm:items-center sm:p-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="m-0 text-base font-bold text-[var(--color-primary)]">
                    {city.name}
                  </h3>
                  <span className="text-sm text-[var(--color-muted)]" lang="ar" dir="rtl">
                    {city.nameAr}
                  </span>
                  {city.isCapital && (
                    <span className="rounded-full bg-[var(--color-secondary-tint)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
                      Capital
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      city.active
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {city.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                  <span className="font-mono font-semibold tracking-wide">
                    {city.cityCode}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 size={14} aria-hidden="true" />
                    {city.timezone}
                  </span>
                  <span>
                    {city.mapCenter.lat.toFixed(4)}, {city.mapCenter.lng.toFixed(4)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <button
                  type="button"
                  onClick={() => void toggleCity(city)}
                  disabled={updatingCityCode === city.cityCode}
                  className={secondaryButtonClassName}
                >
                  {updatingCityCode === city.cityCode ? (
                    <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldCheck size={16} aria-hidden="true" />
                  )}
                  {city.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoneCityCode(city.cityCode);
                    setZoneJson(JSON.stringify(city.zoneFeatures ?? [], null, 2));
                  }}
                  className={secondaryButtonClassName}
                >
                  <MapPinned size={16} aria-hidden="true" />
                  Configure zones
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-slate-50 px-5 py-8 text-center">
          <Building2 size={24} className="mx-auto text-[var(--color-muted)]" aria-hidden="true" />
          <p className="mb-0 mt-3 text-sm font-semibold text-[var(--color-primary)]">
            No operating areas are configured.
          </p>
        </div>
      )}
    </section>

    {zoneCityCode && (
      <form
        onSubmit={saveZones}
        className="grid min-w-0 gap-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">
              Service coverage
            </p>
            <h2 className="m-0 text-lg font-bold text-[var(--color-primary)]">
              Zones — {cities.find((city) => city.cityCode === zoneCityCode)?.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setZoneCityCode("")}
            className={secondaryButtonClassName}
            aria-label="Close service zone editor"
          >
            <X size={16} aria-hidden="true" />
            Close
          </button>
        </div>
        <p className="m-0 text-sm leading-6 text-[var(--color-muted)]">
          Paste a valid GeoJSON array of Polygon or MultiPolygon Features.
          Add at least one station before activating this area.
        </p>
        <label className={labelClassName}>
          City service zones (GeoJSON)
          <textarea
            required
            value={zoneJson}
            onChange={(event) => setZoneJson(event.target.value)}
            rows={12}
            aria-label="City service zones GeoJSON"
            className={`${fieldClassName} h-auto min-h-56 resize-y py-3 font-mono text-xs leading-5`}
          />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingZones}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-bold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/25 disabled:cursor-wait disabled:opacity-60"
          >
            {savingZones && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
            {savingZones ? "Saving zones…" : "Save service zones"}
          </button>
        </div>
      </form>
    )}

    <form
      onSubmit={addCity}
      className="min-w-0 overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] shadow-sm"
    >
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--color-border)] px-4 py-4 sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
            <Plus size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 className="m-0 text-lg font-bold text-[var(--color-primary)]">
              Add City/State
            </h2>
            <p className="mb-0 mt-1 text-sm text-[var(--color-muted)]">
              Enter a unique City/State code and choose its center on the map.
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
          <Globe2 size={14} aria-hidden="true" />
          {regionCode} sequence
        </span>
      </div>

      <div className="grid min-w-0 gap-5 p-4 sm:p-6 xl:grid-cols-2 xl:gap-6">
        <div className="grid content-start gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClassName}>
              City/State name
              <input
                required
                maxLength={100}
                autoComplete="address-level2"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={fieldClassName}
              />
            </label>
            <label className={labelClassName}>
              Arabic name
              <input
                required
                maxLength={100}
                dir="rtl"
                lang="ar"
                value={nameAr}
                onChange={(event) => setNameAr(event.target.value)}
                className={fieldClassName}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClassName}>
              Code
              <input
                required
                maxLength={80}
                autoComplete="off"
                value={cityCode}
                onChange={(event) =>
                  setCityCode(
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, ""),
                  )
                }
                className={`${fieldClassName} font-mono`}
                placeholder="e.g. alexandria"
              />
            </label>
            <label className={labelClassName}>
              Timezone (IANA)
              <input
                required
                maxLength={80}
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className={fieldClassName}
                placeholder="Africa/Cairo"
              />
            </label>
          </div>
          <p className="-mt-3 mb-0 text-xs leading-5 text-[var(--color-muted)]">
            Use lowercase letters, numbers, and hyphens; codes must be unique within this Region. Map selection defaults the timezone to {regionTimezone}.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClassName}>
              Map center latitude
              <input
                required
                type="number"
                step="any"
                min="-90"
                max="90"
                inputMode="decimal"
                value={lat}
                onChange={(event) => setLat(event.target.value)}
                className={fieldClassName}
                placeholder="Click the map or enter latitude"
              />
            </label>
            <label className={labelClassName}>
              Map center longitude
              <input
                required
                type="number"
                step="any"
                min="-180"
                max="180"
                inputMode="decimal"
                value={lng}
                onChange={(event) => setLng(event.target.value)}
                className={fieldClassName}
                placeholder="Click the map or enter longitude"
              />
            </label>
          </div>
          <p className="-mt-3 mb-0 text-xs leading-5 text-[var(--color-muted)]">
            Editing both coordinates moves the pin. Clicking or dragging the pin updates these fields.
          </p>

          <button
            type="submit"
            disabled={saving || !name.trim() || !nameAr.trim() || !timezone.trim() || !mapPoint}
            className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <Plus size={18} aria-hidden="true" />
            )}
            {saving ? "Adding City/State…" : "Add operating area"}
            {!saving && <ArrowUpRight size={16} aria-hidden="true" />}
          </button>
        </div>

        <RegionCityCenterMap
          center={REGIONS[regionCode].map.defaultCenter}
          zoom={REGIONS[regionCode].map.defaultZoom}
          point={mapPoint}
          onPointChange={(point) => {
            setLat(point.lat.toFixed(6));
            setLng(point.lng.toFixed(6));
            setTimezone(regionTimezone);
          }}
        />
      </div>
      </form>
    </main>
  );
}
