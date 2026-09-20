"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClientLocale } from "@/lib/locale.client";
import L from "leaflet";
import { Bookmark, Crosshair, Loader2, MapPin, Search, X } from "lucide-react";
import OsmMapCanvas, { type OsmPoint } from "./OsmMapCanvas";
import { svgIcon } from "./leafletLayers";
import {
  formatDisplayName,
  getPlaceDetails,
  reverseGeocode,
  searchAddress,
} from "@/lib/nominatim";

const CAIRO = { lat: 30.0444, lng: 31.2357 };
const CAIRO_BOUNDS = { north: 30.35, south: 29.75, east: 31.9, west: 30.75 };
const PIN_ICON = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52"><path d="M20 0C8.95 0 0 8.95 0 20c0 14.5 20 36 20 36S40 34.5 40 20C40 8.95 31.05 0 20 0z" fill="#00C2A8"/><circle cx="20" cy="20" r="9" fill="white"/><circle cx="20" cy="20" r="5" fill="#0B1E3D"/></svg>`,
  40,
  52,
);

export interface SavedAddress {
  _id?: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  lat: string;
  lng: string;
  name: string;
  onChange: (lat: string, lng: string, name: string) => void;
  onSaved?: (saved: SavedAddress) => void;
  error?: string;
  savedAddresses?: SavedAddress[];
}

function inCairo(lat: number, lng: number) {
  return (
    lat >= CAIRO_BOUNDS.south &&
    lat <= CAIRO_BOUNDS.north &&
    lng >= CAIRO_BOUNDS.west &&
    lng <= CAIRO_BOUNDS.east
  );
}

const SAVED_PIN_ICON = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38"><path d="M15 0C6.7 0 0 6.7 0 15c0 11 15 23 15 23s15-12 15-23c0-8.3-6.7-15-15-15z" fill="#0B1E3D"/><circle cx="15" cy="15" r="6" fill="#F5A623"/></svg>`,
  30,
  38,
);

export default function LocationPickerMapOsm({
  lat,
  lng,
  name,
  onChange,
  onSaved,
  error,
  savedAddresses,
}: Props) {
  const { t } = useClientLocale();
  const [map, setMap] = useState<L.Map | null>(null);
  const [query, setQuery] = useState(name);
  const [results, setResults] = useState<
    { place_id: string; display_name: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [outOfBounds, setOutOfBounds] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const marker = useMemo(
    () => (lat && lng ? { lat: Number(lat), lng: Number(lng) } : null),
    [lat, lng],
  );
  const isSaved = savedAddresses?.some(
    (place) => place.lat === Number(lat) && place.lng === Number(lng),
  );

  async function saveCurrentLocation() {
    if (!lat || !lng || !name || isSaved || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/auth/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: name.split(",")[0].trim(),
          address: name,
          lat: Number(lat),
          lng: Number(lng),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t("addresses.save_location_failed"));
      onSaved?.(data.savedAddress);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : t("addresses.save_location_failed"));
    } finally {
      setSaving(false);
    }
  }

  // Sync query with name prop
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setQuery(name), [name]);
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const setPoint = useCallback(
    async (newLat: number, newLng: number, moveMap = true) => {
      if (!inCairo(newLat, newLng)) {
        setOutOfBounds(true);
        return;
      }
      setOutOfBounds(false);
      const address =
        formatDisplayName(await reverseGeocode(newLat, newLng)) ||
        `${newLat.toFixed(5)}, ${newLng.toFixed(5)}`;
      setQuery(address);
      onChange(newLat.toFixed(6), newLng.toFixed(6), address);
      if (moveMap) map?.setView([newLat, newLng], 15);
    },
    [map, onChange],
  );

  useEffect(() => {
    if (!map || !map.getPane("markerPane")) return;
    const layer = L.layerGroup().addTo(map);

    if (savedAddresses && savedAddresses.length > 0) {
      savedAddresses.forEach((place) => {
        if (Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
          const savedPin = L.marker([place.lat, place.lng], {
            icon: SAVED_PIN_ICON,
            title: `${place.label}: ${place.address}`,
          }).addTo(layer);
          savedPin.on("click", () => {
            setQuery(place.address);
            onChange(place.lat.toFixed(6), place.lng.toFixed(6), place.address);
            map.setView([place.lat, place.lng], 15);
          });
        }
      });
    }

    if (marker && Number.isFinite(marker.lat) && Number.isFinite(marker.lng)) {
      const pin = L.marker([marker.lat, marker.lng], {
        icon: PIN_ICON,
        draggable: true,
      }).addTo(layer);
      pin.on("dragend", async () => {
        const point = pin.getLatLng();
        await setPoint(point.lat, point.lng, false);
      });
      map.setView([marker.lat, marker.lng], 15);
    }
    return () => {
      layer.remove();
    };
  }, [map, marker, onChange, savedAddresses, setPoint]);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (value.length < 3) return setResults([]);
    timeoutRef.current = setTimeout(async () => {
      setSearching(true);
      setResults(await searchAddress(value));
      setSearching(false);
    }, 380);
  };

  const pickResult = async (placeId: string, displayName: string) => {
    const point = await getPlaceDetails(placeId);
    const label = formatDisplayName(displayName);
    setQuery(label);
    setResults([]);
    onChange(point.lat.toFixed(6), point.lng.toFixed(6), label);
    map?.setView([point.lat, point.lng], 15);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        await setPoint(coords.latitude, coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div>
      {savedAddresses && savedAddresses.length > 0 && (
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-[#5A6A7A] mr-0.5">{t("addresses.saved_places")}:</span>
          {savedAddresses.map((place, idx) => (
            <button
              key={place._id ?? idx}
              type="button"
              onClick={() => {
                setQuery(place.address);
                onChange(place.lat.toFixed(6), place.lng.toFixed(6), place.address);
                map?.setView([place.lat, place.lng], 15);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[#00c2a8]/40 bg-[#effaf8] px-2.5 py-1 text-xs font-extrabold text-[#008a76] hover:bg-[#00c2a8] hover:text-white transition-colors"
            >
              <MapPin size={12} />
              <span>{place.label}</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 48,
            padding: "0 12px",
            background: "#fff",
            border: `1.5px solid ${error ? "#E74C3C" : "#D1D5DB"}`,
            borderRadius: 12,
          }}
        >
          {searching ? (
            <Loader2 size={16} className="animate-spin" color="#00C2A8" />
          ) : (
            <Search size={16} color="#9CA3AF" />
          )}
              <LocalizedSearchInput
                value={query}
                onChange={(value: string) => handleSearch(value)}
              />
          {query && (
            <button
              type="button"
              aria-label={t("common.clear")}
              onClick={() => {
                setQuery("");
                setResults([]);
                onChange("", "", "");
              }}
              style={{
                background: "none",
                border: 0,
                color: "#9CA3AF",
                display: "flex",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        {!!results.length && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 200,
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              marginTop: 4,
              overflow: "hidden",
              boxShadow: "0 8px 24px rgba(11,30,61,.12)",
            }}
          >
            {results.map((result) => (
              <button
                key={result.place_id}
                type="button"
                onMouseDown={() =>
                  void pickResult(result.place_id, result.display_name)
                }
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: 0,
                  borderBottom: "1px solid #F1F5F9",
                  background: "#fff",
                  textAlign: "left",
                  fontFamily: "inherit",
                  display: "flex",
                  gap: 10,
                }}
              >
                <MapPin size={14} color="#00C2A8" />
                <span style={{ fontSize: 13 }}>
                  {formatDisplayName(result.display_name)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        style={{
          height: 280,
          position: "relative",
          overflow: "hidden",
          borderRadius: 14,
          border: `1.5px solid ${error ? "#E74C3C" : "#E2E8F0"}`,
        }}
      >
        <OsmMapCanvas
          center={marker ?? CAIRO}
          zoom={marker ? 15 : 11}
          cursor="crosshair"
          onReady={setMap}
          onClick={(point: OsmPoint) => void setPoint(point.lat, point.lng)}
        />
        <button
          type="button"
          title={t("addresses.use_my_location")}
          aria-label={t("addresses.use_my_location")}
          disabled={locating}
          onClick={useCurrentLocation}
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            zIndex: 10,
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#fff",
            border: "1px solid #E2E8F0",
            color: "#00C2A8",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Crosshair size={18} />
        </button>
        {outOfBounds && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 62,
              zIndex: 10,
              background: "#fff3e0",
              color: "#7a4d00",
              padding: "7px 10px",
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            {t("addresses.cairo_bounds")}
          </div>
        )}
      </div>
      {onSaved && lat && lng && name && !isSaved && (
        <button
          type="button"
          onClick={() => void saveCurrentLocation()}
          disabled={saving}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A6A7A] hover:text-[#008a76] disabled:opacity-50"
        >
          <Bookmark size={13} />
          {saving ? t("addresses.saving_location") : t("addresses.save_location")}
        </button>
      )}
      {saveError && <p className="mt-1 text-xs font-semibold text-[#c0392b]">{saveError}</p>}
    </div>
  );
}

function LocalizedSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t, dir } = useClientLocale();
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t("addresses.select_placeholder")}
      autoComplete="off"
      style={{
        flex: 1,
        border: 0,
        outline: 0,
        fontFamily: "inherit",
        fontSize: 13,
        direction: dir,
      }}
    />
  );
}
