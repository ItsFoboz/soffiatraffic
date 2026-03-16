/**
 * Server-side data layer for Sofia Traffic.
 *
 * Source 1: sofiatraffic.bg Inertia page – lines mapping + stops
 * Source 2: GTFS-RT protobuf feeds from gtfs.sofiatraffic.bg
 *
 * All results are cached in-process with a 1-hour TTL.
 */

import type { VehicleType } from './types';

export interface LineInfo {
  name: string;       // public line number, e.g. "5", "94", "TM1"
  type: VehicleType;
}

export interface SofiaStop {
  ext_id: string;   // GTFS stop_id, e.g. "TB0490"
  code: string;     // 4-digit code, e.g. "0490"
  name: string;
  name_en: string;
  lat: number;
  lng: number;
  type: VehicleType;
}

// type_id from website: 1=bus, 2=tram, 3=metro, 4=trolley, 5=nightbus
const TYPE_MAP: Record<number, VehicleType> = {
  1: 'bus',
  2: 'tram',
  3: 'metro',
  4: 'trolley',
  5: 'bus',
};

let linesCache: Record<string, LineInfo> | null = null;
let stopsCache: SofiaStop[] | null = null;
let dataCacheTime = 0;
const DATA_CACHE_TTL = 3600 * 1000;

export async function fetchSofiaLinesAndStops(): Promise<{
  lines: Record<string, LineInfo>;
  stops: SofiaStop[];
}> {
  const now = Date.now();
  if (linesCache && stopsCache && now - dataCacheTime < DATA_CACHE_TTL) {
    return { lines: linesCache, stops: stopsCache };
  }

  const res = await fetch('https://www.sofiatraffic.bg/bg/transport/schedules', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SofiaTrafficApp/1.0)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(12000),
  });

  const html = await res.text();
  const match = html.match(/data-page="([^"]+)"/);
  if (!match) throw new Error('No Inertia data-page attribute found');

  // Decode HTML entities in the JSON string
  const pageJson = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = JSON.parse(pageJson).props as Record<string, any>;

  // Build ext_id → LineInfo mapping
  const lines: Record<string, LineInfo> = {};
  for (const line of Array.isArray(props.lines) ? props.lines : []) {
    if (line.ext_id && line.name) {
      lines[line.ext_id] = {
        name: String(line.name),
        type: TYPE_MAP[line.type] ?? 'bus',
      };
    }
  }

  // Build stops array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stops: SofiaStop[] = (Array.isArray(props.stops) ? props.stops : []).map((s: any) => ({
    ext_id: String(s.ext_id ?? ''),
    code: String(s.code ?? ''),
    name: String(s.name ?? s.title ?? ''),
    name_en: String(s.name_en ?? ''),
    lat: Array.isArray(s.position) ? Number(s.position[0]) : 0,
    lng: Array.isArray(s.position) ? Number(s.position[1]) : 0,
    type: TYPE_MAP[s.type] ?? 'bus',
  })).filter((s: SofiaStop) => s.lat && s.lng);

  linesCache = lines;
  stopsCache = stops;
  dataCacheTime = now;

  return { lines, stops };
}

// ── GTFS-RT protobuf caches ──────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let vehiclesFeedCache: any | null = null;
let vehiclesCacheTime = 0;
const VEHICLES_CACHE_TTL = 15 * 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tripsFeedCache: any | null = null;
let tripsCacheTime = 0;
const TRIPS_CACHE_TTL = 30 * 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchVehiclesFeed(): Promise<any> {
  const now = Date.now();
  if (vehiclesFeedCache && now - vehiclesCacheTime < VEHICLES_CACHE_TTL) {
    return vehiclesFeedCache;
  }
  const res = await fetch('https://gtfs.sofiatraffic.bg/api/v1/vehicle-positions', {
    signal: AbortSignal.timeout(8000),
  });
  const buffer = await res.arrayBuffer();
  const { transit_realtime } = await import('gtfs-realtime-bindings');
  const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
  vehiclesFeedCache = feed;
  vehiclesCacheTime = now;
  return feed;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchTripUpdatesFeed(): Promise<any> {
  const now = Date.now();
  if (tripsFeedCache && now - tripsCacheTime < TRIPS_CACHE_TTL) {
    return tripsFeedCache;
  }
  const res = await fetch('https://gtfs.sofiatraffic.bg/api/v1/trip-updates', {
    signal: AbortSignal.timeout(10000),
  });
  const buffer = await res.arrayBuffer();
  const { transit_realtime } = await import('gtfs-realtime-bindings');
  const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
  tripsFeedCache = feed;
  tripsCacheTime = now;
  return feed;
}
