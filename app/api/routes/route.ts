import { NextRequest, NextResponse } from 'next/server';
import type { VehicleType } from '@/lib/types';

interface StopData {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
}

interface RouteData {
  id: string;
  line: string;
  type: VehicleType;
  stops: StopData[];
}

const ROUTE_TYPE_MAP: Record<string, VehicleType> = {
  '0': 'tram',
  '1': 'metro',
  '3': 'bus',
  '11': 'trolley',
};

function detectTypeFromId(routeId: string): VehicleType {
  if (!routeId) return 'bus';
  const u = routeId.toUpperCase();
  if (u.startsWith('M') && /^M\d/i.test(routeId)) return 'metro';
  if (u.startsWith('TB') || u.startsWith('TRL')) return 'trolley';
  if (u.startsWith('T') && /^T\d/i.test(routeId)) return 'tram';
  return 'bus';
}

function extractLineNumber(routeId: string, type: VehicleType): string {
  if (!routeId) return '?';
  if (/^\d+$/.test(routeId)) return routeId;
  if (/^M\d+$/i.test(routeId)) return routeId.toUpperCase();
  if (type === 'metro') {
    const m = routeId.match(/M(\d+)/i);
    return m ? `M${m[1]}` : routeId;
  }
  if (type === 'trolley') {
    const m = routeId.match(/^(?:TB|TRL)(\d+.*)/i);
    return m ? m[1] : routeId;
  }
  if (type === 'tram') {
    const m = routeId.match(/^T(\d+.*)/i);
    return m ? m[1] : routeId;
  }
  return routeId;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// In-memory cache for route data (1 hour TTL)
let routesCache: RouteData[] | null = null;
let routesCacheTime = 0;
const CACHE_TTL = 3600 * 1000;

async function fetchAllRoutes(): Promise<RouteData[]> {
  const now = Date.now();
  if (routesCache && now - routesCacheTime < CACHE_TTL) return routesCache;

  const res = await fetch('http://drone.sumc.bg/api/v1/routes/changes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`Routes API ${res.status}`);

  const data = await res.json();
  const routes: RouteData[] = [];

  for (const r of Array.isArray(data) ? data : []) {
    // Flexible field name handling for the drone.sumc.bg response format
    const routeId = String(r.route_id ?? r.routeId ?? r.id ?? '');
    const shortName = String(r.route_short_name ?? r.shortName ?? r.name ?? routeId);
    const routeTypeRaw = r.route_type ?? r.routeType ?? r.type;

    let type: VehicleType;
    let line: string;

    if (routeTypeRaw !== undefined && ROUTE_TYPE_MAP[String(routeTypeRaw)]) {
      type = ROUTE_TYPE_MAP[String(routeTypeRaw)];
      line = extractLineNumber(shortName, type);
    } else {
      type = detectTypeFromId(shortName || routeId);
      line = extractLineNumber(shortName || routeId, type);
    }

    const stops: StopData[] = [];
    for (const s of Array.isArray(r.stops) ? r.stops : []) {
      const lat = parseFloat(s.lat ?? s.latitude ?? 0);
      const lng = parseFloat(s.lon ?? s.longitude ?? s.lng ?? 0);
      if (!lat || !lng) continue;
      stops.push({
        id: String(s.id ?? s.stop_id ?? ''),
        code: String(s.code ?? s.stop_code ?? s.id ?? ''),
        name: String(s.name ?? s.stop_name ?? s.nameBg ?? ''),
        lat,
        lng,
      });
    }

    if (stops.length >= 2) {
      routes.push({ id: routeId, line, type, stops });
    }
  }

  routesCache = routes;
  routesCacheTime = now;
  return routes;
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
    const allRoutes = await fetchAllRoutes();

    const WALK_RADIUS = 700; // meters – max walk to/from a stop
    const results: {
      line: string;
      type: VehicleType;
      boardStop: StopData;
      alightStop: StopData;
      stops: StopData[];
      geometry: [number, number][];
      walkToStop: number;
      walkFromStop: number;
      duration: number;
      numStops: number;
    }[] = [];

    for (const route of allRoutes) {
      // Find stops close to origin
      let bestOrigin: { stop: StopData; idx: number; dist: number } | null = null;
      for (let i = 0; i < route.stops.length; i++) {
        const d = distanceMeters(fromLat, fromLng, route.stops[i].lat, route.stops[i].lng);
        if (d < WALK_RADIUS && (!bestOrigin || d < bestOrigin.dist)) {
          bestOrigin = { stop: route.stops[i], idx: i, dist: d };
        }
      }
      if (!bestOrigin) continue;

      // Find stops close to destination (must come AFTER origin stop)
      let bestDest: { stop: StopData; idx: number; dist: number } | null = null;
      for (let i = bestOrigin.idx + 1; i < route.stops.length; i++) {
        const d = distanceMeters(toLat, toLng, route.stops[i].lat, route.stops[i].lng);
        if (d < WALK_RADIUS && (!bestDest || d < bestDest.dist)) {
          bestDest = { stop: route.stops[i], idx: i, dist: d };
        }
      }
      if (!bestDest) continue;

      const transitStops = route.stops.slice(bestOrigin.idx, bestDest.idx + 1);
      const numStops = transitStops.length;

      // Estimate: 80m/min walking, ~2 min/stop transit
      const walkToMin = Math.round(bestOrigin.dist / 80);
      const walkFromMin = Math.round(bestDest.dist / 80);
      const transitMin = numStops * 2;
      const totalMin = walkToMin + transitMin + walkFromMin;

      results.push({
        line: route.line,
        type: route.type,
        boardStop: bestOrigin.stop,
        alightStop: bestDest.stop,
        stops: transitStops,
        geometry: transitStops.map((s) => [s.lat, s.lng] as [number, number]),
        walkToStop: bestOrigin.dist,
        walkFromStop: bestDest.dist,
        duration: totalMin,
        numStops,
      });
    }

    // De-duplicate: keep only the best option per line
    const seen = new Map<string, (typeof results)[0]>();
    for (const r of results) {
      const key = `${r.type}:${r.line}`;
      const existing = seen.get(key);
      if (!existing || r.duration < existing.duration) seen.set(key, r);
    }

    const deduped = [...seen.values()].sort((a, b) => a.duration - b.duration);

    return NextResponse.json({
      transitRoutes: deduped.slice(0, 6),
      code: deduped.length > 0 ? 'Ok' : 'NoRoute',
    });
  } catch (err) {
    console.error('Route fetch error:', err);
    return NextResponse.json(
      { transitRoutes: [], code: 'Error', error: 'Route calculation failed' },
      { status: 200 }
    );
  }
}
