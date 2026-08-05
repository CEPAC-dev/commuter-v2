// Address search powered by Nominatim/OpenStreetMap (via /api/places/*)

export interface NominatimResult {
  place_id: string;     // Encoded lat,lng tuple for the details endpoint
  display_name: string; // Full description e.g. "Tahrir Square, Cairo, Egypt"
}

export async function searchAddress(query: string): Promise<NominatimResult[]> {
  if (!query || query.length < 3) return [];
  try {
    const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export function formatDisplayName(displayName: string): string {
  // Remove trailing ", Egypt" or ", مصر" for cleaner display
  return displayName.replace(/, (Egypt|مصر)$/, '').trim();
}

export async function getPlaceDetails(placeId: string): Promise<{ lat: number; lng: number }> {
  const res = await fetch(`/api/places/details?id=${encodeURIComponent(placeId)}`);
  if (!res.ok) throw new Error('Place details fetch failed');
  return res.json();
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data.address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

