import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  if (!q) return NextResponse.json({ results: [] });

  try {
    // Use Nominatim (OpenStreetMap) for geocoding - focused on Sofia area
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', Sofia, Bulgaria')}&format=json&limit=5&addressdetails=1&accept-language=bg,en`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'SofiaTransitApp/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`Nominatim ${res.status}`);

    const data = await res.json();

    const results = data.map((item: Record<string, unknown>) => ({
      id: String(item.place_id),
      name: item.display_name,
      lat: parseFloat(item.lat as string),
      lng: parseFloat(item.lon as string),
      type: 'place',
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Geocode error:', err);
    return NextResponse.json({ results: [] });
  }
}
