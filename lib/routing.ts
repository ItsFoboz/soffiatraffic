/**
 * Snap a sequence of transit stops to actual road geometry
 * using the free public OSRM routing API.
 *
 * Falls back to straight-line connections silently if OSRM is unreachable
 * or times out, so the app never breaks — it just degrades gracefully.
 */
export async function snapToRoads(
  stops: { lat: number; lng: number }[],
  profile: 'driving' | 'foot' = 'driving'
): Promise<[number, number][]> {
  if (stops.length < 2) return stops.map((s) => [s.lat, s.lng]);

  // OSRM expects coordinates as "lng,lat" pairs (GeoJSON order), semicolon-separated
  const coords = stops.map((s) => `${s.lng.toFixed(6)},${s.lat.toFixed(6)}`).join(';');

  // router.project-osrm.org only hosts the driving profile.
  // routing.openstreetmap.de hosts separate routed-foot / routed-bike instances.
  const baseUrl =
    profile === 'foot'
      ? `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}`
      : `https://router.project-osrm.org/route/v1/driving/${coords}`;
  const url = `${baseUrl}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return stops.map((s) => [s.lat, s.lng]);

    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]?.geometry?.coordinates?.length) {
      return stops.map((s) => [s.lat, s.lng]);
    }

    // OSRM GeoJSON uses [lng, lat]; Leaflet / our app uses [lat, lng] — swap here
    return (data.routes[0].geometry.coordinates as [number, number][]).map(
      ([lng, lat]) => [lat, lng]
    );
  } catch {
    // Network error or timeout — fall back silently to straight lines
    return stops.map((s) => [s.lat, s.lng]);
  }
}
