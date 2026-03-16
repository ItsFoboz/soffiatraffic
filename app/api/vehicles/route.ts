import { NextResponse } from 'next/server';
import type { Vehicle } from '@/lib/types';
import { fetchSofiaLinesAndStops, fetchVehiclesFeed } from '@/lib/sofiaTrafficData';

export async function GET() {
  try {
    const [feed, { lines }] = await Promise.all([
      fetchVehiclesFeed(),
      fetchSofiaLinesAndStops(),
    ]);

    const vehicles: Vehicle[] = [];

    for (const entity of feed.entity ?? []) {
      const vp = entity.vehicle;
      if (!vp?.position) continue;

      const routeId: string = vp.trip?.routeId ?? '';
      const lineInfo = lines[routeId];

      const line = lineInfo?.name ?? routeId;
      const type = lineInfo?.type ?? 'bus';

      vehicles.push({
        id: entity.id ?? String(Math.random()),
        lat: vp.position.latitude,
        lng: vp.position.longitude,
        bearing: vp.position.bearing ?? undefined,
        speed: vp.position.speed ? Math.round(vp.position.speed * 3.6) : undefined,
        line,
        type,
        tripId: vp.trip?.tripId ?? undefined,
        routeId: routeId || undefined,
        directionHeadsign: vp.trip?.directionHeadsign ?? undefined,
        timestamp: typeof vp.timestamp === 'number' ? vp.timestamp : undefined,
      });
    }

    return NextResponse.json({ vehicles, updatedAt: Date.now() });
  } catch (err) {
    console.error('Vehicle fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch vehicle positions', vehicles: [] },
      { status: 500 }
    );
  }
}
