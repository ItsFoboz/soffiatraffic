import { NextResponse } from 'next/server';
import type { Vehicle, VehicleType } from '@/lib/types';

// Route type prefixes from Sofia Traffic GTFS data
const ROUTE_TYPE_MAP: Record<string, VehicleType> = {
  '0': 'tram',
  '1': 'metro',
  '3': 'bus',
  '11': 'trolley',
};

function detectTypeFromRouteId(routeId: string): VehicleType {
  // Sofia Traffic route ID conventions: T=tram, TB=trolley, M=metro, else bus
  if (!routeId) return 'bus';
  const upper = routeId.toUpperCase();
  if (upper.startsWith('M')) return 'metro';
  if (upper.startsWith('TB') || upper.startsWith('TRL')) return 'trolley';
  if (upper.startsWith('T') && !upper.startsWith('TR')) return 'tram';
  return 'bus';
}

export async function GET() {
  try {
    // Fetch GTFS-RT vehicle positions feed
    const res = await fetch(
      'https://gtfs.sofiatraffic.bg/api/v1/vehicle-positions',
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 15 }, // 15 second cache
      }
    );

    if (!res.ok) {
      throw new Error(`API responded with ${res.status}`);
    }

    const contentType = res.headers.get('content-type') ?? '';

    // The API can return JSON or protobuf
    if (contentType.includes('application/json')) {
      const data = await res.json();
      const vehicles: Vehicle[] = [];

      const entities = data?.entity ?? data?.entities ?? [];
      for (const entity of entities) {
        const vp = entity?.vehicle;
        if (!vp?.position) continue;

        const routeId = vp.trip?.routeId ?? vp.trip?.route_id ?? '';
        const routeType = entity.routeType ?? entity.route_type;
        const type: VehicleType = routeType
          ? (ROUTE_TYPE_MAP[String(routeType)] ?? detectTypeFromRouteId(routeId))
          : detectTypeFromRouteId(routeId);

        vehicles.push({
          id: entity.id ?? String(Math.random()),
          lat: vp.position.latitude,
          lng: vp.position.longitude,
          bearing: vp.position.bearing,
          speed: vp.position.speed ? Math.round(vp.position.speed * 3.6) : undefined,
          line: vp.trip?.routeId ?? vp.trip?.route_id ?? '?',
          type,
          tripId: vp.trip?.tripId ?? vp.trip?.trip_id,
          directionHeadsign: vp.trip?.directionHeadsign ?? vp.trip?.direction_headsign,
          timestamp: vp.timestamp,
        });
      }

      return NextResponse.json({ vehicles, updatedAt: Date.now() });
    }

    // Fallback: try to parse as protobuf using gtfs-realtime-bindings
    const buffer = await res.arrayBuffer();
    const { transit_realtime } = await import('gtfs-realtime-bindings');
    const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

    const vehicles: Vehicle[] = [];
    for (const entity of feed.entity) {
      const vp = entity.vehicle;
      if (!vp?.position) continue;

      const routeId = vp.trip?.routeId ?? '';
      const type = detectTypeFromRouteId(routeId);

      vehicles.push({
        id: entity.id,
        lat: vp.position.latitude,
        lng: vp.position.longitude,
        bearing: vp.position.bearing ?? undefined,
        speed: vp.position.speed ? Math.round(vp.position.speed * 3.6) : undefined,
        line: routeId,
        type,
        tripId: vp.trip?.tripId ?? undefined,
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
