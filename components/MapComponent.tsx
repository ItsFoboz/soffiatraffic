'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Vehicle, Stop } from '@/lib/types';
import { useT } from './TranslationContext';

const SOFIA_CENTER: [number, number] = [42.6977, 23.3219];
const DEFAULT_ZOOM = 13;
const CLUSTER_ZOOM_THRESHOLD = 14;

// CartoDB Positron — muted, low-saturation, ideal for transit overlays
const TILE_URLS = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

const VEHICLE_COLORS: Record<string, string> = {
  bus:     '#1A56DB',
  tram:    '#DC2626',
  trolley: '#059669',
  metro:   '#7C3AED',
};

const STOP_COLORS: Record<string, string> = {
  bus:     '#1A56DB',
  tram:    '#DC2626',
  trolley: '#059669',
  metro:   '#7C3AED',
  default: '#475569',
};

interface MapComponentProps {
  vehicles: Vehicle[];
  stops: Stop[];
  showVehicles: boolean;
  showStops: boolean;
  stopFilter?: string;
  selectedStop?: Stop | null;
  routeCoords?: [number, number][];
  walkPolylines?: [number, number][][];
  vehicleRouteCoords?: [number, number][];
  userLocation?: [number, number] | null;
  onStopClick?: (stop: Stop) => void;
  onVehicleClick?: (vehicle: Vehicle) => void;
  centerOnUser?: boolean;
  followUser?: boolean;
  mapStyle?: 'light' | 'dark';
  /** Called once the Leaflet map is ready; exposes zoom helpers to the parent */
  onMapReady?: (controls: { zoomIn(): void; zoomOut(): void }) => void;
}

function makeVehicleSvg(color: string, bearing: number, line: string): string {
  const label = /^[A-Za-z](\d+)$/.test(line) ? line.slice(1) : line;
  const len = label.length;
  const fontSize = len >= 4 ? 7 : len === 3 ? 9 : len === 2 ? 11 : 13;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="16" fill="${color}" stroke="white" stroke-width="2.5"/>
    <g transform="rotate(${bearing}, 20, 20)">
      <polygon points="20,5 16.5,13 20,11 23.5,13" fill="white" opacity="0.95"/>
    </g>
    <text x="20" y="25" text-anchor="middle" dominant-baseline="auto"
      fill="white" font-size="${fontSize}" font-weight="700"
      font-family="system-ui,-apple-system,sans-serif"
      style="paint-order:stroke" stroke="${color}" stroke-width="1">${label}</text>
  </svg>`;
}

function makeStopSvg(color: string, isSelected: boolean, isSmall: boolean): string {
  if (isSmall) {
    const c = isSelected ? '#F59E0B' : color;
    // Tiny rounded square — clearly different from the circular vehicle blobs
    return `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 9 9">
      <rect x="0.75" y="0.75" width="7.5" height="7.5" rx="2" fill="${c}" stroke="white" stroke-width="1.5"/>
    </svg>`;
  }
  const c = isSelected ? '#F59E0B' : color;
  // Bus-stop sign: coloured board with white lines + pole
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="26" viewBox="0 0 22 26">
    <rect x="1" y="1" width="20" height="14" rx="3.5" fill="${c}" stroke="white" stroke-width="1.8"/>
    <rect x="4.5" y="5"   width="13" height="2" rx="1" fill="white" opacity="0.9"/>
    <rect x="4.5" y="8.5" width="9"  height="2" rx="1" fill="white" opacity="0.7"/>
    <rect x="10.5" y="15" width="1.8" height="10" rx="0.9" fill="${c}" opacity="0.55"/>
  </svg>`;
}

function makeClusterSvg(count: number, color: string): string {
  const size = count >= 20 ? 48 : count >= 10 ? 44 : 38;
  const fontSize = count >= 100 ? 11 : count >= 10 ? 13 : 15;
  const cx = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cx}" r="${cx - 2}" fill="${color}" stroke="white" stroke-width="3" opacity="0.92"/>
    <text x="${cx}" y="${cx + fontSize / 3}" text-anchor="middle"
      fill="white" font-size="${fontSize}" font-weight="700"
      font-family="system-ui,-apple-system,sans-serif">${count}</text>
  </svg>`;
}

export default function MapComponent({
  vehicles,
  stops,
  showVehicles,
  showStops,
  stopFilter = 'all',
  selectedStop,
  routeCoords,
  walkPolylines,
  vehicleRouteCoords,
  userLocation,
  onStopClick,
  onVehicleClick,
  centerOnUser,
  followUser = false,
  mapStyle = 'light',
  onMapReady,
}: MapComponentProps) {
  const { t } = useT();
  const mapRef             = useRef<import('leaflet').Map | null>(null);
  const containerRef       = useRef<HTMLDivElement>(null);
  const vehicleLayerRef    = useRef<import('leaflet').LayerGroup | null>(null);
  const stopLayerRef       = useRef<import('leaflet').LayerGroup | null>(null);
  const tileLayerRef       = useRef<import('leaflet').TileLayer | null>(null);
  const routeLayerRef      = useRef<import('leaflet').Polyline | null>(null);
  const walkLayerRef       = useRef<import('leaflet').LayerGroup | null>(null);
  const vehicleRouteLayerRef = useRef<import('leaflet').Polyline | null>(null);
  const userMarkerRef      = useRef<import('leaflet').Marker | null>(null);
  const initializedRef     = useRef(false);

  // Stable refs so render callbacks don't need to re-run on prop changes
  const stopsRef          = useRef(stops);
  const vehiclesRef       = useRef(vehicles);
  const showStopsRef      = useRef(showStops);
  const showVehiclesRef   = useRef(showVehicles);
  const stopFilterRef     = useRef(stopFilter);
  const selectedStopRef   = useRef(selectedStop);
  const onStopClickRef    = useRef(onStopClick);
  const onVehicleClickRef = useRef(onVehicleClick);
  const tRef              = useRef(t);

  useEffect(() => { stopsRef.current          = stops;         }, [stops]);
  useEffect(() => { vehiclesRef.current       = vehicles;      }, [vehicles]);
  useEffect(() => { showStopsRef.current      = showStops;     }, [showStops]);
  useEffect(() => { showVehiclesRef.current   = showVehicles;  }, [showVehicles]);
  useEffect(() => { stopFilterRef.current     = stopFilter;    }, [stopFilter]);
  useEffect(() => { selectedStopRef.current   = selectedStop;  }, [selectedStop]);
  useEffect(() => { onStopClickRef.current    = onStopClick;   }, [onStopClick]);
  useEffect(() => { onVehicleClickRef.current = onVehicleClick;}, [onVehicleClick]);
  useEffect(() => { tRef.current              = t;             }, [t]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderStops = useCallback((L: any) => {
    if (!stopLayerRef.current || !mapRef.current) return;
    stopLayerRef.current.clearLayers();
    if (!showStopsRef.current) return;

    const zoom = mapRef.current.getZoom();
    if (zoom < 13) return;

    const isSmall     = zoom < 15;
    const activeFilter = stopFilterRef.current;

    for (const stop of stopsRef.current) {
      if (activeFilter !== 'all' && stop.type && stop.type !== activeFilter) continue;
      const isSelected = selectedStopRef.current?.id === stop.id;
      const stopColor  = stop.type ? STOP_COLORS[stop.type] : STOP_COLORS.default;

      const svg  = makeStopSvg(stopColor, isSelected, isSmall);
      const w    = isSmall ? 9  : isSelected ? 26 : 22;
      const h    = isSmall ? 9  : isSelected ? 30 : 26;
      const ax   = w / 2;
      const ay   = isSmall ? h / 2 : h; // pin anchors at its base (bottom-centre)
      const icon = L.divIcon({ html: svg, className: '', iconSize: [w, h], iconAnchor: [ax, ay] });

      const marker = L.marker([stop.lat, stop.lng], { icon, zIndexOffset: isSelected ? 500 : 50 });
      if (onStopClickRef.current) {
        marker.on('click', () => onStopClickRef.current!(stop));
      }
      marker.addTo(stopLayerRef.current!);
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderVehicles = useCallback((L: any) => {
    if (!vehicleLayerRef.current || !mapRef.current) return;
    vehicleLayerRef.current.clearLayers();
    if (!showVehiclesRef.current) return;

    const zoom = mapRef.current.getZoom();
    const vs   = vehiclesRef.current;

    if (zoom < CLUSTER_ZOOM_THRESHOLD) {
      // ── Cluster mode ──────────────────────────────────────────────────────
      // Grid size adapts with zoom: coarser at city level, finer approaching threshold
      const gridSize = Math.pow(2, 13 - Math.min(zoom, 13)) * 0.015;

      const clusters = new Map<string, { vs: Vehicle[]; lat: number; lng: number }>();
      for (const v of vs) {
        const cellLat = Math.round(v.lat / gridSize) * gridSize;
        const cellLng = Math.round(v.lng / gridSize) * gridSize;
        const key = `${cellLat.toFixed(6)},${cellLng.toFixed(6)}`;
        if (!clusters.has(key)) clusters.set(key, { vs: [], lat: cellLat, lng: cellLng });
        clusters.get(key)!.vs.push(v);
      }

      for (const { vs: clusterVs, lat, lng } of clusters.values()) {
        const typeCounts: Record<string, number> = {};
        for (const v of clusterVs) typeCounts[v.type] = (typeCounts[v.type] ?? 0) + 1;
        const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'bus';
        const color = VEHICLE_COLORS[dominantType] ?? '#003DA5';

        const count = clusterVs.length;
        const size  = count >= 20 ? 48 : count >= 10 ? 44 : 38;
        const icon  = L.divIcon({
          html: makeClusterSvg(count, color),
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([lat, lng], { icon, zIndexOffset: 100 });
        // Clicking a cluster zooms in to reveal individual markers
        marker.on('click', () => {
          mapRef.current?.flyTo([lat, lng], CLUSTER_ZOOM_THRESHOLD, { animate: true, duration: 0.6 });
        });
        marker.addTo(vehicleLayerRef.current!);
      }
    } else {
      // ── Individual marker mode ─────────────────────────────────────────────
      for (const v of vs) {
        const color    = VEHICLE_COLORS[v.type] ?? '#374151';
        const svg      = makeVehicleSvg(color, v.bearing ?? 0, v.line);
        const icon     = L.divIcon({ html: svg, className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
        const loc_t    = tRef.current;
        const typeLabel = loc_t(`vehicle.${v.type}`);
        const speedText = v.speed !== undefined ? `${v.speed} ${loc_t('vehicle.kmh')}` : '';

        const marker = L.marker([v.lat, v.lng], { icon, zIndexOffset: 200 });
        marker.bindPopup(`
          <div class="font-sans p-1 min-w-[160px]">
            <div class="font-bold text-base" style="color:${color}">${typeLabel} ${v.line}</div>
            ${v.directionHeadsign ? `<div class="text-sm text-gray-600 mt-1">→ ${v.directionHeadsign}</div>` : ''}
            ${speedText ? `<div class="text-xs text-gray-500 mt-1">${loc_t('vehicle.speed')}: ${speedText}</div>` : ''}
            ${v.routeId ? `<div class="text-xs text-blue-600 mt-2 cursor-pointer show-route-btn" data-route="${v.routeId}">🗺️ Show route on map</div>` : ''}
          </div>
        `);

        marker.on('popupopen', () => {
          const btn = document.querySelector(`.show-route-btn[data-route="${v.routeId}"]`);
          if (btn) {
            btn.addEventListener('click', () => {
              onVehicleClickRef.current?.(v);
              marker.closePopup();
            });
          }
        });
        marker.on('click', () => { if (v.routeId) onVehicleClickRef.current?.(v); });
        marker.addTo(vehicleLayerRef.current!);
      }
    }
  }, []);

  const initMap = useCallback(async () => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const L = (await import('leaflet')).default;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    const map = L.map(containerRef.current, {
      center: SOFIA_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false, // zoom buttons live in the custom controls card
    });

    // Muted CartoDB Positron tiles — transport markers stand out much better
    tileLayerRef.current = L.tileLayer(TILE_URLS.light, {
      attribution: TILE_ATTRIBUTION,
      subdomains:  ['a', 'b', 'c', 'd'],
      maxZoom: 19,
    }).addTo(map);

    vehicleLayerRef.current = L.layerGroup().addTo(map);
    stopLayerRef.current    = L.layerGroup().addTo(map);
    mapRef.current          = map;

    // Expose zoom controls to parent (used by the custom controls card)
    onMapReady?.({ zoomIn: () => map.zoomIn(), zoomOut: () => map.zoomOut() });

    // Re-render layers only when zoom crosses meaningful thresholds
    let prevZoom = DEFAULT_ZOOM;
    map.on('zoomend', () => {
      const z = map.getZoom();
      const stopThresholdCrossed    = (prevZoom < 13) !== (z < 13) || (prevZoom < 15) !== (z < 15);
      const vehicleThresholdCrossed = (prevZoom < CLUSTER_ZOOM_THRESHOLD) !== (z < CLUSTER_ZOOM_THRESHOLD);
      prevZoom = z;
      if (stopThresholdCrossed)    renderStops(L);
      if (vehicleThresholdCrossed) renderVehicles(L);
    });

    const ro = new ResizeObserver(() => { map.invalidateSize(); });
    ro.observe(containerRef.current!);
    (map as unknown as { _resizeObserver: ResizeObserver })._resizeObserver = ro;
  }, [renderStops, renderVehicles, onMapReady]);

  // ── Initialize ──────────────────────────────────────────────────────────
  useEffect(() => {
    initMap();
    return () => {
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapRef.current as any)._resizeObserver?.disconnect();
        mapRef.current.remove();
        mapRef.current = null;
        initializedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Switch tile style ───────────────────────────────────────────────────
  useEffect(() => {
    if (!tileLayerRef.current) return;
    tileLayerRef.current.setUrl(TILE_URLS[mapStyle]);
  }, [mapStyle]);

  // ── Update vehicles ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then(({ default: L }) => renderVehicles(L));
  }, [vehicles, showVehicles, renderVehicles]);

  // ── Update stops ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then(({ default: L }) => renderStops(L));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, showStops, stopFilter, selectedStop]);

  // ── Transit route polyline ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then(({ default: L }) => {
      if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null; }
      if (routeCoords && routeCoords.length > 1) {
        routeLayerRef.current = L.polyline(routeCoords, {
          color: '#003DA5', weight: 5, opacity: 0.85, dashArray: '8, 4',
        }).addTo(mapRef.current!);
        mapRef.current!.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
      }
    });
  }, [routeCoords]);

  // ── Walk segment polylines (dashed grey) ────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then(({ default: L }) => {
      if (!walkLayerRef.current) {
        walkLayerRef.current = L.layerGroup().addTo(mapRef.current!);
      }
      walkLayerRef.current.clearLayers();
      for (const seg of walkPolylines ?? []) {
        if (seg.length > 1) {
          L.polyline(seg, { color: '#6B7280', weight: 3, opacity: 0.75, dashArray: '6, 10' })
            .addTo(walkLayerRef.current!);
        }
      }
    });
  }, [walkPolylines]);

  // ── Vehicle line route overlay ───────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then(({ default: L }) => {
      if (vehicleRouteLayerRef.current) { vehicleRouteLayerRef.current.remove(); vehicleRouteLayerRef.current = null; }
      if (vehicleRouteCoords && vehicleRouteCoords.length > 1) {
        vehicleRouteLayerRef.current = L.polyline(vehicleRouteCoords, {
          color: '#F97316', weight: 5, opacity: 0.9,
        }).addTo(mapRef.current!);
        mapRef.current!.fitBounds(vehicleRouteLayerRef.current.getBounds(), { padding: [50, 50] });
      }
    });
  }, [vehicleRouteCoords]);

  // ── User location marker ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    import('leaflet').then(({ default: L }) => {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(userLocation);
      } else {
        const icon = L.divIcon({
          html: `<div style="position:relative;width:18px;height:18px">
            <div style="position:absolute;inset:0;border-radius:50%;background:rgba(0,61,165,0.2);animation:pulse-ring 1.5s ease-out infinite"></div>
            <div style="position:absolute;inset:3px;border-radius:50%;background:#003DA5;border:2px solid white;box-shadow:0 0 6px rgba(0,61,165,0.5)"></div>
          </div>`,
          className: '', iconSize: [18, 18], iconAnchor: [9, 9],
        });
        userMarkerRef.current = L.marker(userLocation, { icon, zIndexOffset: 1000 }).addTo(mapRef.current!);
      }

      if (centerOnUser) {
        mapRef.current!.setView(userLocation, Math.max(mapRef.current!.getZoom(), 15), { animate: true });
      } else if (followUser) {
        const z = mapRef.current!.getZoom();
        if (z < 16) {
          mapRef.current!.setView(userLocation, 16, { animate: true, duration: 0.8 });
        } else {
          mapRef.current!.panTo(userLocation, { animate: true, duration: 0.3 });
        }
      }
    });
  }, [userLocation, centerOnUser, followUser]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
