"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { LayerGroup, Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import {
  searchAddress,
  getPlaceDetails,
  reverseGeocode,
  formatDisplayName,
} from "@/lib/nominatim";
import { loadLeaflet, svgDataUrl, MAP_COLORS } from "@/lib/leaflet";
import { Search, Loader2, Crosshair, X, MapPin } from "lucide-react";

const CAIRO = { lat: 30.0444, lng: 31.2357 };

// Greater Cairo bounding box (Cairo + Giza + New Cairo + 6th of October + Qalyubia)
const CAIRO_BOUNDS = { north: 30.35, south: 29.75, east: 31.9, west: 30.75 };

function isInCairo(lat: number, lng: number) {
  return (
    lat >= CAIRO_BOUNDS.south &&
    lat <= CAIRO_BOUNDS.north &&
    lng >= CAIRO_BOUNDS.west &&
    lng <= CAIRO_BOUNDS.east
  );
}

// Same teardrop pin icon as UserMap
const PIN_ICON_URL = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52">` +
    `<path d="M20 0C8.95 0 0 8.95 0 20c0 14.5 20 36 20 36S40 34.5 40 20C40 8.95 31.05 0 20 0z" fill="#00C2A8"/>` +
    `<circle cx="20" cy="20" r="9" fill="white"/>` +
    `<circle cx="20" cy="20" r="5" fill="#0B1E3D"/>` +
    `</svg>`,
);

interface LocationPickerMapProps {
  lat: string;
  lng: string;
  name: string;
  onChange: (lat: string, lng: string, name: string) => void;
  error?: string;
}

export default function LocationPickerMap({
  lat,
  lng,
  name,
  onChange,
  error,
}: LocationPickerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LayerGroup | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState(name);
  const [results, setResults] = useState<
    { place_id: string; display_name: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);
  const [outOfBounds, setOutOfBounds] = useState(false);

  const markerPos =
    lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;

  useEffect(() => {
    setQuery(name);
  }, [name]);

  function handleInput(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value || value.length < 2) {
      setResults([]);
      setShowDrop(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const r = await searchAddress(value);
      setResults(r);
      setShowDrop(r.length > 0);
      setSearching(false);
    }, 380);
  }

  async function pickResult(placeId: string, displayName: string) {
    setShowDrop(false);
    setResults([]);
    const formatted = formatDisplayName(displayName);
    setQuery(formatted);
    try {
      const { lat: newLat, lng: newLng } = await getPlaceDetails(placeId);
      onChange(newLat.toFixed(6), newLng.toFixed(6), formatted);
      mapRef.current?.panTo({ lat: newLat, lng: newLng });
      mapRef.current?.setZoom(15);
    } catch {
      /* coords unavailable */
    }
  }

  async function commitLocation(newLat: number, newLng: number) {
    if (!isInCairo(newLat, newLng)) {
      setOutOfBounds(true);
      return;
    }
    setOutOfBounds(false);
    const addr = await reverseGeocode(newLat, newLng);
    const label =
      formatDisplayName(addr) || `${newLat.toFixed(5)}, ${newLng.toFixed(5)}`;
    setQuery(label);
    setShowDrop(false);
    onChange(newLat.toFixed(6), newLng.toFixed(6), label);
  }

  function handleCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        if (!isInCairo(newLat, newLng)) {
          setOutOfBounds(true);
          setLocating(false);
          return;
        }
        setOutOfBounds(false);
        const addr = await reverseGeocode(newLat, newLng);
        const label = formatDisplayName(addr) || "Current location";
        setQuery(label);
        setShowDrop(false);
        onChange(newLat.toFixed(6), newLng.toFixed(6), label);
        mapRef.current?.setView([newLat, newLng], 15);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const onMapLoad = useCallback(() => {
    // no-op: kept to mirror previous structure
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let disposed = false;

    loadLeaflet().then((L) => {
      if (disposed || !mapContainerRef.current) return;
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
        minZoom: 9,
      }).setView([markerPos?.lat ?? CAIRO.lat, markerPos?.lng ?? CAIRO.lng], markerPos ? 15 : 11);

      L.tileLayer(MAP_COLORS.tileUrl, {
        attribution: MAP_COLORS.tileAttribution,
        maxZoom: 19,
      }).addTo(map);

      map.setMaxBounds([
        [CAIRO_BOUNDS.south, CAIRO_BOUNDS.west],
        [CAIRO_BOUNDS.north, CAIRO_BOUNDS.east],
      ]);

      mapRef.current = map;
      layersRef.current = L.layerGroup().addTo(map);
      setLeafletReady(true);
      onMapLoad();
    });

    return () => {
      disposed = true;
      markerRef.current = null;
      layersRef.current?.clearLayers();
      layersRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setLeafletReady(false);
    };
  }, [markerPos, onMapLoad]);

  useEffect(() => {
    if (!mapRef.current) return;

    const handleMapClick = (event: { latlng: { lat: number; lng: number } }) => {
      void commitLocation(event.latlng.lat, event.latlng.lng);
    };

    const map = mapRef.current;
    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [onChange]);

  useEffect(() => {
    if (!mapRef.current || !layersRef.current) return;
    let disposed = false;

    loadLeaflet().then((L) => {
      if (disposed || !layersRef.current || !mapRef.current) return;

      const layers = layersRef.current;
      layers.clearLayers();
      markerRef.current = null;

      if (!markerPos) return;

      const marker = L.marker([markerPos.lat, markerPos.lng], {
        draggable: true,
        icon: L.icon({
          iconUrl: PIN_ICON_URL,
          iconSize: [30, 38],
          iconAnchor: [15, 38],
        }),
      }).addTo(layers);

      marker.on("dragend", () => {
        const next = marker.getLatLng();
        void commitLocation(next.lat, next.lng);
      });

      markerRef.current = marker;
      mapRef.current.setView([markerPos.lat, markerPos.lng], 15);
    });

    return () => {
      disposed = true;
    };
  }, [markerPos?.lat, markerPos?.lng]);

  return (
    <div>
      {/* Search bar */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#fff",
            border: `1.5px solid ${error ? "#E74C3C" : "#D1D5DB"}`,
            borderRadius: 12,
            padding: "0 12px",
            height: 48,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
          onFocusCapture={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#00C2A8";
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 0 3px rgba(0,194,168,0.15)";
          }}
          onBlurCapture={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = error
              ? "#E74C3C"
              : "#D1D5DB";
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 2px 8px rgba(0,0,0,0.06)";
          }}
        >
          {searching ? (
            <Loader2
              size={16}
              className="animate-spin"
              style={{ color: "#00C2A8", flexShrink: 0 }}
            />
          ) : (
            <Search size={16} style={{ color: "#9CA3AF", flexShrink: 0 }} />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setShowDrop(true);
            }}
            placeholder="Search for your default pickup area…"
            autoComplete="off"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 13,
              color: "#0B1E3D",
              fontFamily: "inherit",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setShowDrop(false);
                onChange("", "", "");
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: "#9CA3AF",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
              aria-label="Clear"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showDrop && results.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 200,
              background: "#fff",
              border: "1.5px solid #E2E8F0",
              borderRadius: 12,
              marginTop: 4,
              boxShadow: "0 8px 24px rgba(11,30,61,0.12)",
              overflow: "hidden",
              maxHeight: 240,
              overflowY: "auto",
            }}
          >
            {results.map((r) => (
              <button
                key={r.place_id}
                type="button"
                onMouseDown={() => pickResult(r.place_id, r.display_name)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid #F1F5F9",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#F8F9FA";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                <MapPin size={14} style={{ color: "#00C2A8", flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 13,
                    color: "#0B1E3D",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatDisplayName(r.display_name)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div
        style={{
          borderRadius: 14,
          overflow: "hidden",
          border: `1.5px solid ${error ? "#E74C3C" : "#E2E8F0"}`,
          height: 280,
          position: "relative",
          boxShadow: "0 2px 12px rgba(11,30,61,0.08)",
          cursor: `url("data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44">' +
              '<path d="M16 0C7.16 0 0 7.16 0 16c0 11.6 16 28 16 28S32 27.6 32 16C32 7.16 24.84 0 16 0z" fill="%2300C2A8"/>' +
              '<circle cx="16" cy="16" r="7" fill="white"/>' +
              '<circle cx="16" cy="16" r="4" fill="%230B1E3D"/>' +
              "</svg>",
          )}") 16 44, crosshair`,
        }}
      >
        {!leafletReady ? (
          <div
            style={{
              height: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#F0EDE6",
              color: "#5A6A7A",
              fontSize: 13,
              gap: 8,
            }}
          >
            <Loader2
              size={18}
              className="animate-spin"
              style={{ color: "#00C2A8" }}
            />
            Loading map...
          </div>
        ) : (
          <div ref={mapContainerRef} style={{ width: "100%", height: 280 }} />
        )}

        {/* Locate-me button — floating on map bottom-left */}
        {leafletReady && (
          <button
            type="button"
            onClick={handleCurrentLocation}
            disabled={locating}
            title="Use my location"
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              zIndex: 10,
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#fff",
              border: "1.5px solid #E2E8F0",
              boxShadow: "0 2px 8px rgba(11,30,61,0.15)",
              cursor: locating ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: locating ? "#9CA3AF" : "#00C2A8",
              opacity: locating ? 0.7 : 1,
              transition: "box-shadow 0.15s, transform 0.1s",
            }}
            onMouseEnter={(e) => {
              if (!locating) {
                e.currentTarget.style.boxShadow =
                  "0 4px 14px rgba(0,194,168,0.3)";
                e.currentTarget.style.transform = "scale(1.05)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(11,30,61,0.15)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {locating ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Crosshair size={18} />
            )}
          </button>
        )}

        {/* Out-of-bounds warning */}
        {outOfBounds && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(231,76,60,0.92)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 16px",
              borderRadius: 20,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              backdropFilter: "blur(4px)",
              zIndex: 20,
            }}
          >
            Only locations within Greater Cairo are allowed
          </div>
        )}

        {/* Tap-hint pill — shown before pin is placed */}
        {!markerPos && leafletReady && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(11,30,61,0.8)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 500,
              padding: "6px 14px",
              borderRadius: 20,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              backdropFilter: "blur(4px)",
            }}
          >
            Tap the map to set your location
          </div>
        )}
      </div>

      {error && (
        <p style={{ marginTop: 6, fontSize: 12, color: "#E74C3C" }}>{error}</p>
      )}
    </div>
  );
}
