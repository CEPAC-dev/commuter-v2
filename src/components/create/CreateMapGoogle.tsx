"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TripData } from "./TripCycle";
import type { TripPoint } from "@/lib/store/useTripStore";
import { isSharedVehicle } from "@/lib/geo/stations";
import { isPointInAnyZone, type ZoneFeature } from "@/lib/geo/zones";
import { formatDisplayName, reverseGeocode } from "@/lib/nominatim";
import GoogleMapCanvas from "@/components/map/GoogleMapCanvas";
import { MAP_STYLE } from "@/lib/googleMapsStyle";
import type { MapSettings } from "@/lib/config/mapSettings";
import type { RegionCode, RegionConfig } from "@/lib/config/regions";

type Props = {
  regionCode: RegionCode;
  mapConfig: RegionConfig["map"];
  mapSettings: MapSettings;
  trips: TripData[];
  picking?: {
    tripId: string;
    field: "pickup" | "dropoff" | "stop";
    stopId?: string;
  } | null;
  onMapPick?: (point: TripPoint) => void;
  onStationSelect?: (
    tripId: string,
    field: "pickup" | "dropoff",
    stationId: number,
  ) => void;
  onCancelPick?: () => void;
};

type GoogleMapInstance = {
  fitBounds: (
    bounds: { extend: (point: { lat: number; lng: number }) => void },
    padding?: number,
  ) => void;
};

type GoogleOverlay = { setMap: (map: GoogleMapInstance | null) => void };

type GoogleMapsNamespace = {
  Marker: new (options: {
    map: GoogleMapInstance;
    position: { lat: number; lng: number };
    label: string;
    title: string;
  }) => GoogleOverlay & {
    addListener: (event: string, action: () => void) => void;
  };
  Polygon: new (options: {
    map: GoogleMapInstance;
    paths: Array<Array<{ lat: number; lng: number }>>;
    strokeColor: string;
    strokeWeight: number;
    fillOpacity: number;
  }) => GoogleOverlay;
  Polyline: new (options: {
    map: GoogleMapInstance;
    path: Array<{ lat: number; lng: number }>;
    strokeColor: string;
    strokeWeight: number;
  }) => GoogleOverlay;
  LatLngBounds: new () => {
    extend: (point: { lat: number; lng: number }) => void;
  };
};

export default function CreateMapGoogle({
  regionCode,
  mapConfig,
  mapSettings,
  trips,
  picking,
  onMapPick,
  onStationSelect,
  onCancelPick,
}: Props) {
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [zones, setZones] = useState<ZoneFeature[]>([]);
  const points = useMemo(
    () =>
      trips.flatMap((trip) =>
        [trip.pickup, trip.dropoff, ...trip.stops.map((stop) => stop.point)]
          .filter(Boolean)
          .map((point) => point as TripPoint),
      ),
    [trips],
  );
  const activeZones = useMemo(
    () => (mapSettings.showZones && regionCode === "EG-CAIRO" ? zones : []),
    [mapSettings.showZones, regionCode, zones],
  );

  useEffect(() => {
    if (!mapSettings.showZones || regionCode !== "EG-CAIRO") return;
    let cancelled = false;
    fetch("/geo/zone_polygon.geojson")
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load zone data.");
        return response.json();
      })
      .then((geojson: { features?: ZoneFeature[] }) => {
        if (!cancelled) {
          setZones(
            (geojson.features ?? []).filter(
              (feature) =>
                feature.geometry?.type === "Polygon" ||
                feature.geometry?.type === "MultiPolygon",
            ),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setZones([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mapSettings.showZones, regionCode]);

  useEffect(() => {
    const map = mapRef.current;
    const googleMaps = (
      window as Window & { google?: { maps?: GoogleMapsNamespace } }
    ).google?.maps;
    if (!map || !googleMaps) return;
    const layers: GoogleOverlay[] = [];
    const addMarker = (
      position: { lat: number; lng: number },
      label: string,
      title: string,
      action?: () => void,
    ) => {
      const marker = new googleMaps.Marker({ map, position, label, title });
      if (action) marker.addListener("click", action);
      layers.push(marker);
    };

    activeZones.forEach(({ geometry }) => {
      if (!geometry) return;
      const polygons =
        geometry.type === "Polygon"
          ? [geometry.coordinates]
          : geometry.coordinates;
      polygons.forEach((polygon) =>
        layers.push(
          new googleMaps.Polygon({
            map,
            paths: polygon.map((ring) =>
              ring.map(([lng, lat]) => ({ lat, lng })),
            ),
            strokeColor: "#00C2A8",
            strokeWeight: 2,
            fillOpacity: 0,
          }),
        ),
      );
    });

    trips.forEach((trip, index) => {
      const color = ["#4361EE", "#F5A623", "#00C2A8"][index % 3];
      if (trip.routeCoordinates?.length) {
        layers.push(
          new googleMaps.Polyline({
            map,
            path: trip.routeCoordinates.map(([lat, lng]) => ({ lat, lng })),
            strokeColor: color,
            strokeWeight: 5,
          }),
        );
      }
      if (trip.pickup) addMarker(trip.pickup, "A", `Trip ${index + 1} pickup`);
      if (trip.dropoff)
        addMarker(trip.dropoff, "B", `Trip ${index + 1} dropoff`);
      if (!isSharedVehicle(trip.vehicleType)) {
        trip.stops.forEach(
          (stop, stopIndex) =>
            stop.point &&
            addMarker(
              stop.point,
              String(stopIndex + 1),
              `Trip ${index + 1} stop`,
            ),
        );
      }
      if (mapSettings.showStations) {
        trip.pickupStationOptions.forEach((station) =>
          addMarker(station, "S", `Pickup station: ${station.name}`, () =>
            onStationSelect?.(trip.id, "pickup", station.id),
          ),
        );
        trip.dropoffStationOptions.forEach((station) =>
          addMarker(station, "S", `Dropoff station: ${station.name}`, () =>
            onStationSelect?.(trip.id, "dropoff", station.id),
          ),
        );
        if (trip.pickup && trip.pickupStation) {
          layers.push(
            new googleMaps.Polyline({
              map,
              path: [
                { lat: trip.pickup.lat, lng: trip.pickup.lng },
                {
                  lat: trip.pickupStation.lat,
                  lng: trip.pickupStation.lng,
                },
              ],
              strokeColor: "#F5A623",
              strokeWeight: 3,
            }),
          );
        }
        if (trip.dropoff && trip.dropoffStation) {
          layers.push(
            new googleMaps.Polyline({
              map,
              path: [
                {
                  lat: trip.dropoffStation.lat,
                  lng: trip.dropoffStation.lng,
                },
                { lat: trip.dropoff.lat, lng: trip.dropoff.lng },
              ],
              strokeColor: "#F5A623",
              strokeWeight: 3,
            }),
          );
        }
      }
    });

    if (points.length) {
      const bounds = new googleMaps.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, 48);
    }
    return () => layers.forEach((layer) => layer.setMap?.(null));
  }, [
    mapReady,
    mapSettings.showStations,
    onStationSelect,
    points,
    trips,
    activeZones,
  ]);

  const onClick = useCallback(
    async ({ lat, lng }: { lat: number; lng: number }) => {
      if (!picking || !onMapPick) return;
      if (
        mapSettings.showZones &&
        (!activeZones.length || !isPointInAnyZone([lng, lat], activeZones))
      ) {
        window.alert(
          activeZones.length
            ? "This location is outside the available service zones."
            : "The service zones are still loading. Please try again in a moment.",
        );
        return;
      }
      let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const value = formatDisplayName(
          await reverseGeocode(lat, lng, "google"),
        );
        if (value) address = value;
      } catch {
        // Keep coordinate text if reverse geocoding is unavailable.
      }
      onMapPick({ address, lat, lng });
    },
    [activeZones, mapSettings.showZones, onMapPick, picking],
  );

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="map-provider-unavailable">
        Google Maps is unavailable. Ask an administrator to configure the public
        Google Maps key or choose OpenStreetMap.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <GoogleMapCanvas
        center={mapConfig.defaultCenter}
        zoom={mapConfig.defaultZoom}
        onReady={(map: GoogleMapInstance | null) => {
          mapRef.current = map;
          setMapReady(Boolean(map));
        }}
        onClick={onClick}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          styles: mapSettings.canvasStyle === "light" ? MAP_STYLE : undefined,
          mapTypeId:
            mapSettings.canvasStyle === "satellite" ? "satellite" : "roadmap",
          draggableCursor: picking ? "crosshair" : undefined,
        }}
      />
      {picking ? (
        <div className="map-pick-banner">
          Click map to set{" "}
          {picking.field === "stop" ? "stop point" : picking.field}
          <button type="button" onClick={onCancelPick}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
