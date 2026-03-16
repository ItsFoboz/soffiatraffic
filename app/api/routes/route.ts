import { NextRequest, NextResponse } from 'next/server';
import type { VehicleType } from '@/lib/types';
import { fetchTripUpdatesFeed, fetchSofiaLinesAndStops } from '@/lib/sofiaTrafficData';

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
  const fromLat = parseFloat(request.nextUrl.searchParams.get('fromLat') ?? '');
  const fromLng = parseFloat(request.nextUrl.searchParams.get('fromLng') ?? '');
  const toLat = parseFloat(request.nextUrl.searchParams.get('toLat') ?? '');
  const toLng = parseFloat(request.nextUrl.searchParams.get('toLng') ?? '');

  if ([fromLat, fromLng, toLat, toLng].some(isNaN)) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
  }

  try {
    const [feed, { lines, stops }] = await Promise.all([
      fetchTripUpdatesFeed(),
      fetchSofiaLinesAndStops(),
    ]);

    // Build ext_id → stop lookup
    const stopByExtId = new Map(stops.map((s) => [s.ext_id, s]));

    const WALK_RADIUS = 700; // metres
    const results: {
      line: string;
      type: VehicleType;
      boardStop: { id: string; code: string; name: string; lat: number; lng: number };
      alightStop: { id: string; code: string; name: string; lat: number; lng: number };
      stops: { id: string; code: string; name: string; lat: number; lng: number }[];
      geometry: [number, number][];
      walkToStop: number;
      walkFromStop: number;
      duration: number;
      numStops: number;
    }[] = [];

    for (const entity of feed.entity ?? []) {
      const tu = entity.tripUpdate;
      if (!tu) continue;

      const routeId: string = tu.trip?.routeId ?? '';
      const lineInfo = lines[routeId];
      if (!lineInfo) continue;

      const updates = tu.stopTimeUpdate ?? [];
      if (updates.length < 2) continue;

      // Resolve stop coordinates
      const tripStops = updates
        .map((stu: { stopId: string }) => {
          const s = stopByExtId.get(stu.stopId);
          if (!s) return null;
          return { id: s.ext_id, code: s.code, name: s.name, lat: s.lat, lng: s.lng };
        })
        .filter(Boolean) as { id: string; code: string; name: string; lat: number; lng: number }[];

      if (tripStops.length < 2) continue;

      // Find boarding stop (closest to origin within walk radius)
      let bestBoard: { stop: typeof tripStops[0]; idx: number; dist: number } | null = null;
      for (let i = 0; i < tripStops.length; i++) {
        const d = distanceMeters(fromLat, fromLng, tripStops[i].lat, tripStops[i].lng);
        if (d < WALK_RADIUS && (!bestBoard || d < bestBoard.dist)) {
          bestBoard = { stop: tripStops[i], idx: i, dist: d };
        }
      }
      if (!bestBoard) continue;

      // Find alighting stop (closest to destination, must be AFTER boarding)
      let bestAlight: { stop: typeof tripStops[0]; idx: number; dist: number } | null = null;
      for (let i = bestBoard.idx + 1; i < tripStops.length; i++) {
        const d = distanceMeters(toLat, toLng, tripStops[i].lat, tripStops[i].lng);
        if (d < WALK_RADIUS && (!bestAlight || d < bestAlight.dist)) {
          bestAlight = { stop: tripStops[i], idx: i, dist: d };
        }
      }
      if (!bestAlight) continue;

      const segment = tripStops.slice(bestBoard.idx, bestAlight.idx + 1);
      const numStops = segment.length;

      const walkToMin = Math.round(bestBoard.dist / 80);
      const walkFromMin = Math.round(bestAlight.dist / 80);
      const transitMin = numStops * 2;
      const totalMin = walkToMin + transitMin + walkFromMin;

      results.push({
        line: lineInfo.name,
        type: lineInfo.type,
        boardStop: bestBoard.stop,
        alightStop: bestAlight.stop,
        stops: segment,
        geometry: segment.map((s) => [s.lat, s.lng] as [number, number]),
        walkToStop: bestBoard.dist,
        walkFromStop: bestAlight.dist,
        duration: totalMin,
        numStops,
      });
    }

    // Deduplicate: keep best (shortest) option per line
    const seen = new Map<string, typeof results[0]>();
    for (const r of results) {
      const key = `${r.type}:${r.line}`;
      const ex = seen.get(key);
      if (!ex || r.duration < ex.duration) seen.set(key, r);
    }

    const deduped = [...seen.values()].sort((a, b) => a.duration - b.duration);

    return NextResponse.json({
      transitRoutes: deduped.slice(0, 6),
      code: deduped.length > 0 ? 'Ok' : 'NoRoute',
    });
  } catch (err) {
    console.error('Route error:', err);
    return NextResponse.json({ transitRoutes: [], code: 'Error' });
  }
}
