import { NextRequest, NextResponse } from 'next/server';
import type { VehicleType } from '@/lib/types';
import { fetchTripUpdatesFeed, fetchSofiaLinesAndStops } from '@/lib/sofiaTrafficData';
import { snapToRoads } from '@/lib/routing';

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

type StopInfo = { id: string; code: string; name: string; lat: number; lng: number };

function resolveTripStops(
  updates: { stopId: string }[],
  stopByExtId: Map<string, { ext_id: string; code: string; name: string; lat: number; lng: number }>,
): StopInfo[] {
  return updates
    .map((stu) => {
      const s = stopByExtId.get(stu.stopId);
      return s ? { id: s.ext_id, code: s.code, name: s.name, lat: s.lat, lng: s.lng } : null;
    })
    .filter(Boolean) as StopInfo[];
}

export async function GET(request: NextRequest) {
  const fromLat = parseFloat(request.nextUrl.searchParams.get('fromLat') ?? '');
  const fromLng = parseFloat(request.nextUrl.searchParams.get('fromLng') ?? '');
  const toLat   = parseFloat(request.nextUrl.searchParams.get('toLat')   ?? '');
  const toLng   = parseFloat(request.nextUrl.searchParams.get('toLng')   ?? '');

  if ([fromLat, fromLng, toLat, toLng].some(isNaN)) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
  }

  try {
    const [feed, { lines, stops }] = await Promise.all([
      fetchTripUpdatesFeed(),
      fetchSofiaLinesAndStops(),
    ]);

    const stopByExtId = new Map(stops.map((s) => [s.ext_id, s]));
    const WALK_RADIUS = 700; // metres

    type DirectResult = {
      line: string; type: VehicleType;
      boardStop: StopInfo; alightStop: StopInfo;
      stops: StopInfo[]; geometry: [number, number][];
      walkToStop: number; walkFromStop: number;
      duration: number; numStops: number;
      walkGeometry?: [number, number][][];
    };
    const directResults: DirectResult[] = [];

    // ── Leg-1 / Leg-2 index for transfer routing ──────────────────────────
    type Leg1Candidate = {
      line: string; type: VehicleType;
      boardIdx: number; boardWalk: number; tripStops: StopInfo[];
    };
    type Leg2Connection = {
      line: string; type: VehicleType;
      boardIdx: number; alightIdx: number;
      alightStop: StopInfo; alightWalk: number; tripStops: StopInfo[];
    };
    const leg1Candidates: Leg1Candidate[] = [];
    const leg2Index = new Map<string, Leg2Connection[]>(); // stopId → connections

    for (const entity of feed.entity ?? []) {
      const tu = entity.tripUpdate;
      if (!tu) continue;
      const routeId: string = tu.trip?.routeId ?? '';
      const lineInfo = lines[routeId];
      if (!lineInfo) continue;

      const tripStops = resolveTripStops(tu.stopTimeUpdate ?? [], stopByExtId);
      if (tripStops.length < 2) continue;

      // ── Direct route finding ──────────────────────────────────────────
      let bestBoard: { idx: number; dist: number } | null = null;
      let bestAlight: { idx: number; dist: number } | null = null;

      for (let i = 0; i < tripStops.length; i++) {
        const dFrom = distanceMeters(fromLat, fromLng, tripStops[i].lat, tripStops[i].lng);
        const dTo   = distanceMeters(toLat,   toLng,   tripStops[i].lat, tripStops[i].lng);
        if (dFrom < WALK_RADIUS && (!bestBoard  || dFrom < bestBoard.dist))  bestBoard  = { idx: i, dist: dFrom };
        if (dTo   < WALK_RADIUS && (!bestAlight || dTo   < bestAlight.dist)) bestAlight = { idx: i, dist: dTo   };
      }

      if (bestBoard && bestAlight && bestAlight.idx > bestBoard.idx) {
        const segment = tripStops.slice(bestBoard.idx, bestAlight.idx + 1);
        const numStops = segment.length;
        const walkToMin   = Math.round(bestBoard.dist  / 80);
        const walkFromMin = Math.round(bestAlight.dist / 80);
        directResults.push({
          line: lineInfo.name, type: lineInfo.type,
          boardStop:  tripStops[bestBoard.idx],
          alightStop: tripStops[bestAlight.idx],
          stops: segment,
          geometry: segment.map((s) => [s.lat, s.lng] as [number, number]),
          walkToStop:   bestBoard.dist,
          walkFromStop: bestAlight.dist,
          duration: walkToMin + numStops * 2 + walkFromMin,
          numStops,
        });
      }

      // ── Build leg-1 / leg-2 indexes for transfer routing ─────────────
      if (bestBoard) {
        leg1Candidates.push({
          line: lineInfo.name, type: lineInfo.type,
          boardIdx: bestBoard.idx, boardWalk: bestBoard.dist, tripStops,
        });
      }
      if (bestAlight) {
        for (let i = 0; i < bestAlight.idx; i++) {
          const sid = tripStops[i].id;
          if (!leg2Index.has(sid)) leg2Index.set(sid, []);
          leg2Index.get(sid)!.push({
            line: lineInfo.name, type: lineInfo.type,
            boardIdx: i, alightIdx: bestAlight.idx,
            alightStop: tripStops[bestAlight.idx],
            alightWalk: bestAlight.dist, tripStops,
          });
        }
      }
    }

    // ── Deduplicate direct results ─────────────────────────────────────
    const directSeen = new Map<string, DirectResult>();
    for (const r of directResults) {
      const key = `${r.type}:${r.line}`;
      const ex = directSeen.get(key);
      if (!ex || r.duration < ex.duration) directSeen.set(key, r);
    }
    const direct = [...directSeen.values()].sort((a, b) => a.duration - b.duration);

    if (direct.length > 0) {
      const top = direct.slice(0, 6);
      // Snap transit geometry to roads; also snap walk segments using pedestrian profile
      await Promise.all(top.map(async (r) => {
        const [transitGeo, walkTo, walkFrom] = await Promise.all([
          snapToRoads(r.stops),
          snapToRoads([{ lat: fromLat, lng: fromLng }, r.boardStop], 'foot'),
          snapToRoads([r.alightStop, { lat: toLat, lng: toLng }], 'foot'),
        ]);
        r.geometry = transitGeo;
        r.walkGeometry = [walkTo, walkFrom];
      }));
      return NextResponse.json({ transitRoutes: top, code: 'Ok' });
    }

    // ── No direct route — try 1-transfer routes ────────────────────────
    type TransferResult = DirectResult & {
      isTransfer: true;
      line2: string; type2: VehicleType;
      boardStop2: StopInfo; alightStop2: StopInfo;
      stops2: StopInfo[];
      transferStop: StopInfo; transferWalk: number;
      numStops2: number;
    };

    const transferSeen = new Map<string, TransferResult>();

    for (const leg1 of leg1Candidates) {
      for (let ti = leg1.boardIdx + 1; ti < leg1.tripStops.length; ti++) {
        const tsStop = leg1.tripStops[ti];
        const connections = leg2Index.get(tsStop.id);
        if (!connections) continue;

        for (const conn of connections) {
          // Must be a different line and alight after the board point
          if (conn.line === leg1.line) continue;
          if (conn.alightIdx <= conn.boardIdx) continue;

          const numStops1 = ti - leg1.boardIdx;
          const numStops2 = conn.alightIdx - conn.boardIdx;
          const walkToMin   = Math.round(leg1.boardWalk  / 80);
          const walkFromMin = Math.round(conn.alightWalk / 80);
          const totalMin = walkToMin + numStops1 * 2 + 5 /* transfer */ + numStops2 * 2 + walkFromMin;

          const key = `${leg1.line}→${conn.line}`;
          const ex = transferSeen.get(key);
          if (ex && ex.duration <= totalMin) continue;

          const leg1Seg = leg1.tripStops.slice(leg1.boardIdx, ti + 1);
          const leg2Seg = conn.tripStops.slice(conn.boardIdx, conn.alightIdx + 1);

          transferSeen.set(key, {
            // Base (leg-1 perspective):
            line: leg1.line, type: leg1.type,
            boardStop:  leg1.tripStops[leg1.boardIdx],
            alightStop: tsStop,
            stops: leg1Seg,
            geometry: [...leg1Seg, ...leg2Seg].map((s) => [s.lat, s.lng] as [number, number]),
            walkToStop:   leg1.boardWalk,
            walkFromStop: conn.alightWalk,
            duration: totalMin,
            numStops: numStops1,
            // Transfer / leg-2:
            isTransfer: true,
            line2: conn.line, type2: conn.type,
            boardStop2:  conn.tripStops[conn.boardIdx],
            alightStop2: conn.alightStop,
            stops2: leg2Seg,
            transferStop: tsStop,
            transferWalk: 0,
            numStops2,
          });
        }
      }
    }

    const transfers = [...transferSeen.values()].sort((a, b) => a.duration - b.duration);

    const topTransfers = transfers.slice(0, 3);
    // Snap each leg to roads separately; also snap all three walk segments
    await Promise.all(topTransfers.map(async (r) => {
      const [geo1, geo2, walkTo, walkTransfer, walkFrom] = await Promise.all([
        snapToRoads(r.stops),
        snapToRoads(r.stops2 ?? []),
        snapToRoads([{ lat: fromLat, lng: fromLng }, r.boardStop], 'foot'),
        snapToRoads([r.transferStop, r.boardStop2], 'foot'),
        snapToRoads([r.alightStop2, { lat: toLat, lng: toLng }], 'foot'),
      ]);
      r.geometry = [...geo1, ...geo2];
      r.walkGeometry = [walkTo, walkTransfer, walkFrom];
    }));

    return NextResponse.json({
      transitRoutes: topTransfers,
      code: topTransfers.length > 0 ? 'Ok' : 'NoRoute',
    });

  } catch (err) {
    console.error('Route error:', err);
    return NextResponse.json({ transitRoutes: [], code: 'Error' });
  }
}
