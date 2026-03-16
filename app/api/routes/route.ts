import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const fromLat = request.nextUrl.searchParams.get('fromLat');
  const fromLng = request.nextUrl.searchParams.get('fromLng');
  const toLat = request.nextUrl.searchParams.get('toLat');
  const toLng = request.nextUrl.searchParams.get('toLng');

  if (!fromLat || !fromLng || !toLat || !toLng) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
  }

  try {
    // Use OpenTripPlanner-compatible API via a public routing service
    // We use OpenRouteService or OSRM public endpoints for Sofia
    // For transit routing, we use the Navitia.io public API (free tier)
    // Alternatively, use OSRM for driving/walking directions
    const url = `https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&steps=true&annotations=false&geometries=geojson`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) throw new Error(`OSRM responded ${res.status}`);

    const data = await res.json();

    return NextResponse.json({
      routes: data.routes ?? [],
      code: data.code,
    });
  } catch (err) {
    console.error('Route fetch error:', err);
    return NextResponse.json({ routes: [], error: 'Route calculation failed' }, { status: 200 });
  }
}
