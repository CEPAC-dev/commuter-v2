"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

export interface OsmPoint {
  lat: number;
  lng: number;
}

interface OsmMapCanvasProps {
  center?: OsmPoint;
  zoom?: number;
  className?: string;
  style?: React.CSSProperties;
  cursor?: string;
  onReady?: (map: L.Map) => void;
  onClick?: (point: OsmPoint) => void;
}

const CAIRO = { lat: 30.0444, lng: 31.2357 };

export default function OsmMapCanvas({
  center = CAIRO,
  zoom = 11,
  className,
  style,
  cursor,
  onReady,
  onClick,
}: OsmMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const readyRef = useRef(onReady);
  const clickRef = useRef(onClick);

  useEffect(() => {
    readyRef.current = onReady;
    clickRef.current = onClick;
  }, [onReady, onClick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      clickRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    });
    mapRef.current = map;
    readyRef.current?.(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center.lat, center.lng, zoom]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", cursor, ...style }}
    />
  );
}
