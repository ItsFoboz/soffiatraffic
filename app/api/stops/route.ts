import { NextResponse } from 'next/server';
import type { Stop } from '@/lib/types';

// We cache the stops data since it rarely changes
let stopsCache: Stop[] | null = null;
let stopsCacheTime = 0;
const STOPS_CACHE_TTL = 3600 * 1000; // 1 hour

async function fetchStopsFromGTFS(): Promise<Stop[]> {
  try {
    // Try the drone.sumc.bg API first for stop data
    const res = await fetch('http://drone.sumc.bg/api/v1/routes/changes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (res.ok) {
      const data = await res.json();
      const stops: Stop[] = [];
      const seen = new Set<string>();

      if (Array.isArray(data)) {
        for (const route of data) {
          if (Array.isArray(route.stops)) {
            for (const s of route.stops) {
              if (s.id && !seen.has(String(s.id))) {
                seen.add(String(s.id));
                stops.push({
                  id: String(s.id),
                  code: s.code ?? String(s.id),
                  name: s.name ?? s.nameBg ?? 'Stop',
                  nameBg: s.nameBg ?? s.name,
                  lat: parseFloat(s.lat ?? s.latitude ?? 0),
                  lng: parseFloat(s.lon ?? s.longitude ?? s.lng ?? 0),
                });
              }
            }
          }
        }
      }

      if (stops.length > 0) return stops;
    }
  } catch {
    // Fall through to next method
  }

  // Fallback: use Overpass API to get Sofia bus stops from OpenStreetMap
  try {
    const query = `[out:json][timeout:30];
      (
        node["public_transport"="stop_position"]["network"~"Sofia|ЦГМ|Център"][bbox=42.55,23.20,42.80,23.50];
        node["highway"="bus_stop"][bbox=42.55,23.20,42.80,23.50];
      );
      out body;`;

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });

    if (res.ok) {
      const data = await res.json();
      return (data.elements ?? [])
        .filter((e: Record<string, unknown>) => e.lat && e.lon)
        .map((e: Record<string, unknown>) => ({
          id: String(e.id),
          code: (e.tags as Record<string, string>)?.ref ?? String(e.id),
          name: (e.tags as Record<string, string>)?.name ?? (e.tags as Record<string, string>)?.['name:bg'] ?? 'Stop',
          nameBg: (e.tags as Record<string, string>)?.['name:bg'],
          lat: e.lat as number,
          lng: e.lon as number,
        }));
    }
  } catch {
    // Return empty
  }

  return [];
}

export async function GET() {
  const now = Date.now();
  if (stopsCache && now - stopsCacheTime < STOPS_CACHE_TTL) {
    return NextResponse.json({ stops: stopsCache });
  }

  const stops = await fetchStopsFromGTFS();
  stopsCache = stops;
  stopsCacheTime = now;

  return NextResponse.json({ stops });
}
