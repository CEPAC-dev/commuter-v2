"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MapProviderName } from "@/lib/config/mapSettings";

const MapSearchContext = createContext<MapProviderName>("osm");

export function MapSearchProvider({ provider, children }: { provider: MapProviderName; children: ReactNode }) {
  return <MapSearchContext.Provider value={provider}>{children}</MapSearchContext.Provider>;
}

export function useMapSearchProvider() {
  return useContext(MapSearchContext);
}
