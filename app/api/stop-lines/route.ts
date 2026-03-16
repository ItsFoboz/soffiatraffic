import { NextRequest, NextResponse } from 'next/server';
import type { VehicleType } from '@/lib/types';
import { fetchTripUpdatesFeed, fetchSofiaLinesAndStops } from '@/lib/sofiaTrafficData';

export interface StopLine {
  routeId: string;
  name: string;
  type: VehicleType;
  directions: string[];
}

export async function GET(request: NextRequest) {
  const stopCode = request.nextUrl.searchParams.get('stopCode');
  const stopId = request.nextUrl.searchParams.get('stopId');

  if (!stopCode && !stopId) {
    return NextResponse.json({ error: 'stopCode or stopId required' }, { status: 400 });
  }

  try {
    const [feed, { lines }] = await Promise.all([
      fetchTripUpdatesFeed(),
      fetchSofiaLinesAndStops(),
    ]);

    // Build set of candidate stop IDs to match in the trip feed
    const candidateIds = new Set<string>();
    if (stopId) candidateIds.add(stopId);
    if (stopCode) {
      candidateIds.add(`A${stopCode}`);
      candidateIds.add(`TB${stopCode}`);
      candidateIds.add(`TM${stopCode}`);
      candidateIds.add(`M${stopCode}`);
    }

    const lineMap = new Map<string, { name: string; type: VehicleType; directions: Set<string> }>();

    for (const entity of feed.entity ?? []) {
      const tu = entity.tripUpdate;
      if (!tu) continue;

      const routeId: string = tu.trip?.routeId ?? '';
      const lineInfo = lines[routeId];
      if (!lineInfo) continue;

      const hasStop = (tu.stopTimeUpdate ?? []).some(
        (stu: { stopId: string }) => candidateIds.has(stu.stopId)
      );
      if (!hasStop) continue;

      if (!lineMap.has(routeId)) {
        lineMap.set(routeId, { name: lineInfo.name, type: lineInfo.type, directions: new Set() });
      }
      const direction = tu.trip?.directionHeadsign ?? '';
      if (direction) lineMap.get(routeId)!.directions.add(direction);
    }

    const typeOrder: Record<VehicleType, number> = { metro: 0, tram: 1, trolley: 2, bus: 3 };

    const result: StopLine[] = Array.from(lineMap.entries())
      .map(([routeId, info]) => ({
        routeId,
        name: info.name,
        type: info.type,
        directions: Array.from(info.directions),
      }))
      .sort((a, b) => {
        const ta = typeOrder[a.type] ?? 9;
        const tb = typeOrder[b.type] ?? 9;
        if (ta !== tb) return ta - tb;
        return a.name.localeCompare(b.name, 'bg', { numeric: true });
      });

    return NextResponse.json({ lines: result });
  } catch (err) {
    console.error('Stop-lines error:', err);
    return NextResponse.json({ lines: [] });
  }
}
