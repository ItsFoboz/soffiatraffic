import { NextRequest, NextResponse } from 'next/server';
import type { ArrivalTime } from '@/lib/types';
import { fetchTripUpdatesFeed, fetchSofiaLinesAndStops } from '@/lib/sofiaTrafficData';

export async function GET(request: NextRequest) {
  const stopCode = request.nextUrl.searchParams.get('stopCode');
  if (!stopCode) {
    return NextResponse.json({ error: 'stopCode required' }, { status: 400 });
  }

  try {
    const [feed, { lines }] = await Promise.all([
      fetchTripUpdatesFeed(),
      fetchSofiaLinesAndStops(),
    ]);

    const now = Math.floor(Date.now() / 1000);
    const arrivals: ArrivalTime[] = [];

    // Possible GTFS stop_id prefixes for a given code
    const candidateIds = new Set([
      `A${stopCode}`,
      `TB${stopCode}`,
      `TM${stopCode}`,
      `M${stopCode}`,
    ]);

    for (const entity of feed.entity ?? []) {
      const tu = entity.tripUpdate;
      if (!tu) continue;

      const routeId: string = tu.trip?.routeId ?? '';
      const lineInfo = lines[routeId];
      if (!lineInfo) continue;

      for (const stu of tu.stopTimeUpdate ?? []) {
        if (!candidateIds.has(stu.stopId)) continue;

        // Get arrival time (Unix seconds)
        const arrivalTs =
          (typeof stu.arrival?.time === 'number' ? stu.arrival.time : null) ??
          (typeof stu.departure?.time === 'number' ? stu.departure.time : null);

        if (arrivalTs === null) continue;

        const minutesRaw = Math.round((arrivalTs - now) / 60);
        const minutes = Math.max(0, minutesRaw);

        // Only show arrivals in the next 60 minutes
        if (minutesRaw > 60 || minutesRaw < -2) continue;

        arrivals.push({
          line: lineInfo.name,
          type: lineInfo.type,
          direction: tu.trip?.directionHeadsign ?? '',
          minutes,
          isRealtime: true,
        });

        break; // Only count this route once per stop
      }
    }

    // Sort by arrival time, deduplicate by line+direction
    arrivals.sort((a, b) => a.minutes - b.minutes);

    const seen = new Set<string>();
    const deduped = arrivals.filter((a) => {
      const key = `${a.type}:${a.line}:${a.direction}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({ arrivals: deduped });
  } catch (err) {
    console.error('Arrivals fetch error:', err);
    return NextResponse.json({ arrivals: [] });
  }
}
