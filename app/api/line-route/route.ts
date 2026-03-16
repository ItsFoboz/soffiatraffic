/**
 * GET /api/line-route?routeId=TB3
 *
 * Returns the stop sequence and polyline geometry for a given GTFS route_id
 * by finding an active trip in the trip-updates feed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchTripUpdatesFeed, fetchSofiaLinesAndStops } from '@/lib/sofiaTrafficData';

export async function GET(request: NextRequest) {
  const routeId = request.nextUrl.searchParams.get('routeId');
  if (!routeId) return NextResponse.json({ error: 'routeId required' }, { status: 400 });

  try {
    const [feed, { stops, lines }] = await Promise.all([
      fetchTripUpdatesFeed(),
      fetchSofiaLinesAndStops(),
    ]);

    const stopByExtId = new Map(stops.map((s) => [s.ext_id, s]));
    const lineInfo = lines[routeId];

    // Find the trip for this route with the most stops (= most complete)
    let bestStops: { id: string; code: string; name: string; lat: number; lng: number }[] = [];

    for (const entity of feed.entity ?? []) {
      const tu = entity.tripUpdate;
      if (!tu) continue;
      if (tu.trip?.routeId !== routeId) continue;

      const tripStops = (tu.stopTimeUpdate ?? [])
        .map((stu: { stopId: string }) => {
          const s = stopByExtId.get(stu.stopId);
          if (!s) return null;
          return { id: s.ext_id, code: s.code, name: s.name, lat: s.lat, lng: s.lng };
        })
        .filter(Boolean) as { id: string; code: string; name: string; lat: number; lng: number }[];

      if (tripStops.length > bestStops.length) {
        bestStops = tripStops;
      }
    }

    if (bestStops.length < 2) {
      return NextResponse.json({ stops: [], geometry: [], line: null });
    }

    return NextResponse.json({
      stops: bestStops,
      geometry: bestStops.map((s) => [s.lat, s.lng]),
      line: lineInfo ? { name: lineInfo.name, type: lineInfo.type } : null,
    });
  } catch (err) {
    console.error('Line-route error:', err);
    return NextResponse.json({ stops: [], geometry: [], line: null });
  }
}
