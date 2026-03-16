import { NextResponse } from 'next/server';
import { fetchSofiaLinesAndStops } from '@/lib/sofiaTrafficData';
import type { Stop } from '@/lib/types';

export async function GET() {
  try {
    const { stops } = await fetchSofiaLinesAndStops();

    const result: Stop[] = stops.map((s) => ({
      id: s.ext_id,
      code: s.code,
      name: s.name,
      nameBg: s.name,
      lat: s.lat,
      lng: s.lng,
      type: s.type,
      lines: [],
    }));

    return NextResponse.json({ stops: result });
  } catch (err) {
    console.error('Stops fetch error:', err);
    return NextResponse.json({ stops: [] });
  }
}
