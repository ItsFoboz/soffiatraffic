'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Vehicle, Stop } from '@/lib/types';
import { useT } from './TranslationContext';

// Sofia center coordinates
const SOFIA_CENTER: [number, number] = [42.6977, 23.3219];
const DEFAULT_ZOOM = 13;

const VEHICLE_COLORS: Record<string, string> = {
  bus: '#2563EB',
  tram: '#DC2626',
  trolley: '#16A34A',
  metro: '#7C3AED',
};

const STOP_COLORS: Record<string, string> = {
  bus: '#2563EB',
  tram: '#DC2626',
  trolley: '#16A34A',
  metro: '#7C3AED',
  default: '#475569',
};

interface MapComponentProps {
  vehicles: Vehicle[];
  stops: Stop[];
  showVehicles: boolean;
  showStops: boolean;
  stopFilter?: string; // 'all' | VehicleType — filters which stop types are visible
  selectedStop?: Stop | null;
  routeCoords?: [number, number][];
  vehicleRouteCoords?: [number, number][];
  userLocation?: [number, number] | null;
  onStopClick?: (stop: Stop) => void;
  onVehicleClick?: (vehicle: Vehicle) => void;
  centerOnUser?: boolean;
}

function makeVehicleSvg(color: string, bearing: number, line: string): string {
  // Adaptive font size based on line label length
  const len = line.length;
  const fontSize = len >= 4 ? 7 : len === 3 ? 9 : len === 2 ? 11 : 13;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="16" fill="${color}" stroke="white" stroke-width="2.5"/>
    <g transform="rotate(${bearing}, 20, 20)">
      <polygon points="20,5 16.5,13 20,11 23.5,13" fill="white" opacity="0.95"/>
    </g>
    <text x="20" y="25" text-anchor="middle" dominant-baseline="auto"
      fill="white" font-size="${fontSize}" font-weight="700"
      font-family="system-ui,-apple-system,sans-serif"
      style="paint-order:stroke" stroke="${color}" stroke-width="1">${line}</text>
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
  vehicleRouteCoords,
  userLocation,
  onStopClick,
  onVehicleClick,
  centerOnUser,
}: MapComponentProps) {
  const { t } = useT();
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const vehicleLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const stopLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const routeLayerRef = useRef<import('leaflet').Polyline | null>(null);
  const vehicleRouteLayerRef = useRef<import('leaflet').Polyline | null>(null);
  const userMarkerRef = useRef<import('leaflet').Marker | null>(null);
  const initializedRef = useRef(false);

  // Keep refs to latest stop-related props so the zoom handler can access them
  const stopsRef = useRef(stops);
  const showStopsRef = useRef(showStops);
  const stopFilterRef = useRef(stopFilter);
  const selectedStopRef = useRef(selectedStop);
  const onStopClickRef = useRef(onStopClick);
  const onVehicleClickRef = useRef(onVehicleClick);
  const tRef = useRef(t);

  useEffect(() => { stopsRef.current = stops; }, [stops]);
  useEffect(() => { showStopsRef.current = showStops; }, [showStops]);
  useEffect(() => { stopFilterRef.current = stopFilter; }, [stopFilter]);
  useEffect(() => { selectedStopRef.current = selectedStop; }, [selectedStop]);
  useEffect(() => { onStopClickRef.current = onStopClick; }, [onStopClick]);
  useEffect(() => { onVehicleClickRef.current = onVehicleClick; }, [onVehicleClick]);
  useEffect(() => { tRef.current = t; }, [t]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderStops = useCallback((L: any) => {
    if (!stopLayerRef.current || !mapRef.current) return;
    stopLayerRef.current.clearLayers();
    if (!showStopsRef.current) return;

    const zoom = mapRef.current.getZoom();
    if (zoom < 13) return;

    const isSmall = zoom < 15;
    const activeFilter = stopFilterRef.current;

    for (const stop of stopsRef.current) {
      // Filter by type when a specific type is selected
      if (activeFilter !== 'all' && stop.type && stop.type !== activeFilter) continue;

      const isSelected = selectedStopRef.current?.id === stop.id;
      const stopColor = stop.type ? STOP_COLORS[stop.type] : STOP_COLORS.default;

      const marker = L.circleMarker([stop.lat, stop.lng], {
        radius: isSelected ? 9 : isSmall ? 4 : 6,
        fillColor: isSelected ? '#F59E0B' : stopColor,
        color: 'white',
        weight: isSelected ? 2.5 : 1.5,
        fillOpacity: isSelected ? 1 : 0.85,
      });

      if (onStopClickRef.current) {
        marker.on('click', () => onStopClickRef.current!(stop));
      }
      marker.addTo(stopLayerRef.current!);
    }
  }, []);

  const initMap = useCallback(async () => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const L = (await import('leaflet')).default;

    // Fix Leaflet default icon issue in Next.js
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    const map = L.map(containerRef.current, {
      center: SOFIA_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    vehicleLayerRef.current = L.layerGroup().addTo(map);
    stopLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Only re-render stops when zoom crosses a display threshold to avoid flashing
    let prevZoom = DEFAULT_ZOOM;
    map.on('zoomend', () => {
      const z = map.getZoom();
      const thresholdCrossed =
        (prevZoom < 13) !== (z < 13) || // visibility threshold
        (prevZoom < 15) !== (z < 15);    // size threshold
      prevZoom = z;
      if (thresholdCrossed) renderStops(L);
    });
  }, [renderStops]);

  // Initialize map
  useEffect(() => {
    initMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initializedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update vehicles
  useEffect(() => {
    if (!mapRef.current || !vehicleLayerRef.current) return;
    import('leaflet').then(({ default: L }) => {
      vehicleLayerRef.current!.clearLayers();
      if (!showVehicles) return;

      for (const v of vehicles) {
        const color = VEHICLE_COLORS[v.type] ?? '#374151';
        const svg = makeVehicleSvg(color, v.bearing ?? 0, v.line);

        const icon = L.divIcon({
          html: svg,
          className: '',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const typeLabel = t(`vehicle.${v.type}`);
        const speedText = v.speed !== undefined ? `${v.speed} ${t('vehicle.kmh')}` : '';

        const marker = L.marker([v.lat, v.lng], { icon, zIndexOffset: 200 });

        marker.bindPopup(`
          <div class="font-sans p-1 min-w-[160px]">
            <div class="font-bold text-base" style="color:${color}">${typeLabel} ${v.line}</div>
            ${v.directionHeadsign ? `<div class="text-sm text-gray-600 mt-1">→ ${v.directionHeadsign}</div>` : ''}
            ${speedText ? `<div class="text-xs text-gray-500 mt-1">${t('vehicle.speed')}: ${speedText}</div>` : ''}
            ${v.routeId ? `<div class="text-xs text-blue-600 mt-2 cursor-pointer show-route-btn" data-route="${v.routeId}">🗺️ Show route on map</div>` : ''}
          </div>
        `);

        // Allow clicking the "Show route" link inside popup
        marker.on('popupopen', () => {
          const btn = document.querySelector(`.show-route-btn[data-route="${v.routeId}"]`);
          if (btn) {
            btn.addEventListener('click', () => {
              onVehicleClickRef.current?.(v);
              marker.closePopup();
            });
          }
        });

        // Also allow clicking the marker itself
        marker.on('click', () => {
          if (v.routeId) onVehicleClickRef.current?.(v);
        });

        marker.addTo(vehicleLayerRef.current!);
      }
    });
  }, [vehicles, showVehicles, t]);

  // Update stops — onStopClick and renderStops are accessed via refs / stable callbacks,
  // so they must NOT be in the dep array (avoids re-draw on every vehicle-refresh cycle).
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then(({ default: L }) => renderStops(L));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, showStops, stopFilter, selectedStop]);

  // Update transit route polyline (from route planner)
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then(({ default: L }) => {
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }
      if (routeCoords && routeCoords.length > 1) {
        routeLayerRef.current = L.polyline(routeCoords, {
          color: '#2563EB',
          weight: 5,
          opacity: 0.85,
          dashArray: '8, 4',
        }).addTo(mapRef.current!);
        mapRef.current!.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
      }
    });
  }, [routeCoords]);

  // Vehicle line route overlay (shown when clicking a vehicle)
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then(({ default: L }) => {
      if (vehicleRouteLayerRef.current) {
        vehicleRouteLayerRef.current.remove();
        vehicleRouteLayerRef.current = null;
      }
      if (vehicleRouteCoords && vehicleRouteCoords.length > 1) {
        vehicleRouteLayerRef.current = L.polyline(vehicleRouteCoords, {
          color: '#F97316',   // orange — distinct from the blue route planner line
          weight: 5,
          opacity: 0.9,
        }).addTo(mapRef.current!);
        mapRef.current!.fitBounds(vehicleRouteLayerRef.current.getBounds(), { padding: [50, 50] });
      }
    });
  }, [vehicleRouteCoords]);

  // Update user location
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    import('leaflet').then(({ default: L }) => {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(userLocation);
      } else {
        const icon = L.divIcon({
          html: `<div style="position:relative;width:18px;height:18px">
            <div style="position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,0.25);animation:pulse-ring 1.5s ease-out infinite"></div>
            <div style="position:absolute;inset:3px;border-radius:50%;background:#3B82F6;border:2px solid white;box-shadow:0 0 6px rgba(59,130,246,0.6)"></div>
          </div>`,
          className: '',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        userMarkerRef.current = L.marker(userLocation, { icon, zIndexOffset: 1000 }).addTo(mapRef.current!);
      }

      if (centerOnUser) {
        mapRef.current!.setView(userLocation, 15);
      }
    });
  }, [userLocation, centerOnUser]);

  return (
    <div className="relative w-full h-full">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
