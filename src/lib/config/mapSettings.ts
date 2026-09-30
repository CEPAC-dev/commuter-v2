import type { RegionCode } from "@/lib/config/regions";

export type MapProviderName = "google" | "osm";
export type MapCanvasStyle = "roadmap" | "satellite" | "light";
export type OsmMapThemeName = "default" | "app" | "midnight" | "forest";

export const OSM_THEMES: Record<
  OsmMapThemeName,
  {
    label: string;
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
  }
> = {
  default: {
    label: "Default",
    primary: "#00C2A8",
    secondary: "#0B1E3D",
    accent: "#F5A623",
    surface: "rgba(255,255,255,0.84)",
  },
  app: {
    label: "App colors",
    primary: "#0B1E3D",
    secondary: "#00C2A8",
    accent: "#F5A623",
    surface: "rgba(11,30,61,0.08)",
  },
  midnight: {
    label: "Midnight",
    primary: "#7C3AED",
    secondary: "#22D3EE",
    accent: "#F59E0B",
    surface: "rgba(15,23,42,0.82)",
  },
  forest: {
    label: "Forest",
    primary: "#2E7D32",
    secondary: "#16A34A",
    accent: "#F59E0B",
    surface: "rgba(20,83,45,0.12)",
  },
};

export interface MapSettings {
  regionCode: RegionCode;
  provider: MapProviderName;
  canvasStyle: MapCanvasStyle;
  osmTheme: OsmMapThemeName;
  showStations: boolean;
  showZones: boolean;
  showZoneLabels: boolean;
  maskOutsideZones: boolean;
}

export function defaultMapSettings(regionCode: RegionCode): MapSettings {
  return {
    regionCode,
    provider: "google",
    canvasStyle: "roadmap",
    osmTheme: "app",
    showStations: true,
    // Only Greater Cairo currently has a committed service-zone dataset.
    showZones: regionCode === "EG-CAIRO",
    // Keep zone labels hidden for now while the service-area boundary remains visible.
    showZoneLabels: false,
    maskOutsideZones: regionCode === "EG-CAIRO",
  };
}
