"use client";

import L from "leaflet";

export interface LatLng {
  lat: number;
  lng: number;
}

export function svgIcon(
  svg: string,
  width: number,
  height: number,
  anchor: [number, number] = [width / 2, height],
): L.DivIcon {
  return L.divIcon({
    className: "",
    html: svg,
    iconSize: [width, height],
    iconAnchor: anchor,
  });
}

export function fitPoints(map: L.Map, points: LatLng[], padding = 36) {
  if (!points.length) return;
  if (points.length === 1) {
    map.setView([points[0].lat, points[0].lng], 14);
    return;
  }
  map.fitBounds(
    points.map((point) => [point.lat, point.lng] as L.LatLngTuple),
    {
      padding: [padding, padding],
    },
  );
}
