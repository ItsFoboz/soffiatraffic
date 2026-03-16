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

interface MapComponentProps {
  vehicles: Vehicle[];
  stops: Stop[];
  showVehicles: boolean;
  showStops: boolean;
  selectedStop?: Stop | null;
  routeCoords?: [number, number][];
  userLocation?: [number, number] | null;
  onStopClick?: (stop: Stop) => void;
  centerOnUser?: boolean;
}

export default function MapComponent({
  vehicles,
  stops,
  showVehicles,
  showStops,
  selectedStop,
  routeCoords,
  userLocation,
  onStopClick,
  centerOnUser,
}: MapComponentProps) {
  const { t } = useT();
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const vehicleLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const stopLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const routeLayerRef = useRef<import('leaflet').Polyline | null>(null);
  const userMarkerRef = useRef<import('leaflet').Marker | null>(null);
  const initializedRef = useRef(false);

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
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    vehicleLayerRef.current = L.layerGroup().addTo(map);
    stopLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
  }, []);

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
        const bearing = v.bearing ?? 0;

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
          <g transform="rotate(${bearing}, 16, 16)">
            <circle cx="16" cy="16" r="12" fill="${color}" stroke="white" stroke-width="2"/>
            <polygon points="16,4 12,14 16,12 20,14" fill="white" opacity="0.9"/>
          </g>
          <text x="16" y="21" text-anchor="middle" fill="white" font-size="8" font-weight="bold" font-family="sans-serif">${v.line}</text>
        </svg>`;

        const icon = L.divIcon({
          html: svg,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const typeLabel = t(`vehicle.${v.type}`);
        const speedText = v.speed !== undefined ? `${v.speed} ${t('vehicle.kmh')}` : '';

        const marker = L.marker([v.lat, v.lng], { icon });
        marker.bindPopup(`
          <div class="font-sans p-1 min-w-[140px]">
            <div class="font-bold text-base" style="color:${color}">${typeLabel} ${v.line}</div>
            ${v.directionHeadsign ? `<div class="text-sm text-gray-600 mt-1">→ ${v.directionHeadsign}</div>` : ''}
            ${speedText ? `<div class="text-xs text-gray-500 mt-1">${t('vehicle.speed')}: ${speedText}</div>` : ''}
          </div>
        `);
        marker.addTo(vehicleLayerRef.current!);
      }
    });
  }, [vehicles, showVehicles, t]);

  // Update stops
  useEffect(() => {
    if (!mapRef.current || !stopLayerRef.current) return;
    import('leaflet').then(({ default: L }) => {
      stopLayerRef.current!.clearLayers();
      if (!showStops) return;

      const zoom = mapRef.current!.getZoom();
      if (zoom < 14) return; // Don't show stops when zoomed out

      for (const stop of stops) {
        const isSelected = selectedStop?.id === stop.id;
        const icon = L.circleMarker([stop.lat, stop.lng], {
          radius: isSelected ? 8 : 5,
          fillColor: isSelected ? '#F59E0B' : '#6B7280',
          color: 'white',
          weight: 2,
          fillOpacity: 0.9,
        });

        icon.bindPopup(`
          <div class="font-sans p-1">
            <div class="font-bold text-sm">${stop.name}</div>
            ${stop.code ? `<div class="text-xs text-gray-500">${t('stop.code')}: ${stop.code}</div>` : ''}
          </div>
        `);

        if (onStopClick) {
          icon.on('click', () => onStopClick(stop));
        }

        icon.addTo(stopLayerRef.current!);
      }
    });
  }, [stops, showStops, selectedStop, onStopClick, t]);

  // Update route polyline
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

  // Update user location
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    import('leaflet').then(({ default: L }) => {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(userLocation);
      } else {
        const icon = L.divIcon({
          html: `<div class="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg pulse-animation"></div>`,
          className: '',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        userMarkerRef.current = L.marker(userLocation, { icon }).addTo(mapRef.current!);
      }

      if (centerOnUser) {
        mapRef.current!.setView(userLocation, 15);
      }
    });
  }, [userLocation, centerOnUser]);

  // Re-render stops on zoom change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onZoom = () => {
      // Trigger stop re-render on zoom
      if (stopLayerRef.current) {
        stopLayerRef.current.clearLayers();
      }
    };
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, []);

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
