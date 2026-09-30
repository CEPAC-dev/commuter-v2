"use client";

import { useEffect, useRef } from "react";

let loader: Promise<void> | null = null;

function loadGoogleMaps() {
  if ((window as { google?: unknown }).google) return Promise.resolve();
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "")}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Maps failed to load"));
      document.head.appendChild(script);
    });
  }
  return loader;
}

export default function GoogleMapCanvas({
  center,
  zoom,
  options,
  onReady,
  onClick,
}: {
  center: { lat: number; lng: number };
  zoom: number;
  options?: Record<string, unknown>;
  onReady?: (map: any | null) => void;
  onClick?: (point: { lat: number; lng: number }) => void;
}) {
  const element = useRef<HTMLDivElement | null>(null);
  const callbacks = useRef({ onReady, onClick });
  useEffect(() => { callbacks.current = { onReady, onClick }; });
  useEffect(() => {
    if (!element.current || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return;
    let cancelled = false;
    void loadGoogleMaps().then(() => {
      if (cancelled || !element.current) return;
      const g = (window as any).google;
      const map = new g.maps.Map(element.current, { center, zoom, ...options });
      map.addListener("click", (event: any) => callbacks.current.onClick?.({ lat: event.latLng.lat(), lng: event.latLng.lng() }));
      callbacks.current.onReady?.(map);
    }).catch(() => {});
    return () => { cancelled = true; callbacks.current.onReady?.(null); };
  }, []);
  return <div ref={element} style={{ width: "100%", height: "100%" }} />;
}
