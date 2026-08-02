export interface LeafletModule {
  default: typeof import("leaflet");
}

/** Brand map palette — single source for all Leaflet/OSM map components. */
export const MAP_COLORS = {
  primary: "#0B1E3D",
  secondary: "#00C2A8",
  accent: "#F5A623",
  muted: "#5A6A7A",
  route: "#4361EE",
  danger: "#E74C3C",
  tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileAttribution: "&copy; OpenStreetMap contributors",
} as const;

let leafletPromise: Promise<typeof import("leaflet")> | null = null;

export function loadLeaflet(): Promise<typeof import("leaflet")> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet can only be loaded in the browser"));
  }

  if (!leafletPromise) {
    leafletPromise = import("leaflet").then((module) => {
      const Leaflet = module.default;
      delete (Leaflet.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
      return Leaflet;
    });
  }

  return leafletPromise;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function dashedLinePattern(color: string) {
  return {
    dashArray: "8 8",
    color,
    weight: 3,
    opacity: 0.9,
  };
}