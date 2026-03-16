import { NextRequest, NextResponse } from 'next/server';
import type { ArrivalTime, VehicleType } from '@/lib/types';

const TYPE_MAP: Record<string, VehicleType> = {
  А: 'bus',
  Б: 'bus',
  ТМ: 'tram',
  ТБ: 'trolley',
  М: 'metro',
};

function detectType(line: string, typeStr?: string): VehicleType {
  if (typeStr) {
    const t = TYPE_MAP[typeStr.toUpperCase()];
    if (t) return t;
  }
  const l = line.toUpperCase();
  if (l.startsWith('M') || l === 'M1' || l === 'M2' || l === 'M3' || l === 'M4') return 'metro';
  if (/^\d+$/.test(l)) {
    const n = parseInt(l);
    if (n <= 22) return 'tram';
    if (n >= 100 && n <= 109) return 'trolley';
  }
  return 'bus';
}

export async function GET(request: NextRequest) {
  const stopCode = request.nextUrl.searchParams.get('stopCode');
  if (!stopCode) {
    return NextResponse.json({ error: 'stopCode is required' }, { status: 400 });
  }

  try {
    const res = await fetch('http://drone.sumc.bg/api/v1/timing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stopCode }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`API ${res.status}`);

    const data = await res.json();
    const arrivals: ArrivalTime[] = [];

    // The API returns varied formats; normalize here
    const items = Array.isArray(data) ? data : (data?.times ?? data?.arrivals ?? []);
    for (const item of items) {
      const line = item.line ?? item.route ?? item.routeId ?? '?';
      const minutes = parseInt(item.time ?? item.minutes ?? item.eta ?? '0');
      arrivals.push({
        line: String(line),
        type: detectType(String(line), item.type),
        direction: item.direction ?? item.headsign ?? item.destination ?? '',
        minutes: isNaN(minutes) ? 0 : minutes,
        isRealtime: item.isRealtime ?? item.realtime ?? false,
      });
    }

    arrivals.sort((a, b) => a.minutes - b.minutes);
    return NextResponse.json({ arrivals });
  } catch (err) {
    console.error('Arrivals fetch error:', err);
    return NextResponse.json({ arrivals: [], error: 'Could not load arrivals' }, { status: 200 });
  }
}
