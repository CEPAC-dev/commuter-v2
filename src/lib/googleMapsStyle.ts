/** Shared Google Maps canvas treatment. Keep map chrome quiet behind Commuter UI. */
export const MAP_STYLE: object[] = [
  { elementType: "geometry", stylers: [{ color: "#eef3f3" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#0B1E3D" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#dce7e6" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cce9e6" }] },
];
