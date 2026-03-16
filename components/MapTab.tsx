'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Vehicle, Stop, VehicleType } from '@/lib/types';
import { useT } from './TranslationContext';
import VehicleFilter from './VehicleFilter';
import StopArrivals from './StopArrivals';

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-gray-500">Loading map…</p>
      </div>
    </div>
  ),
});

type FilterOption = 'all' | VehicleType;

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface MapTabProps {
  routeCoords?: [number, number][];
  onClearRoute?: () => void;
  /** Stop selected from another tab — opens its arrivals sheet */
  jumpToStop?: Stop | null;
  onJumpToStopHandled?: () => void;
  stops?: Stop[];
  userLocation?: [number, number] | null;
}

export default function MapTab({
  routeCoords,
  onClearRoute,
  jumpToStop,
  onJumpToStopHandled,
  stops: stopsProp = [],
  userLocation: userLocationProp = null,
}: MapTabProps) {
  const { t } = useT();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stops, setStops] = useState<Stop[]>(stopsProp);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [showVehicles, setShowVehicles] = useState(true);
  const [showStops, setShowStops] = useState(true);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(userLocationProp);
  const [centerOnUser, setCenterOnUser] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showNearbyPanel, setShowNearbyPanel] = useState(false);
  const [vehicleRouteCoords, setVehicleRouteCoords] = useState<[number, number][] | undefined>();
  const [vehicleRouteLine, setVehicleRouteLine] = useState<{ name: string; type: VehicleType } | null>(null);
  const fetchingRef = useRef(false);

  // Sync props → state
  useEffect(() => { if (stopsProp.length) setStops(stopsProp); }, [stopsProp]);
  useEffect(() => { if (userLocationProp) setUserLocation(userLocationProp); }, [userLocationProp]);

  const fetchVehicles = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await fetch('/api/vehicles');
      const data = await res.json();
      if (Array.isArray(data.vehicles)) {
        setVehicles(data.vehicles);
        setLastUpdate(new Date());
      }
    } catch {
      // silently fail on background refresh
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const fetchStops = useCallback(async () => {
    if (stopsProp.length) return; // already loaded by parent
    try {
      const res = await fetch('/api/stops');
      const data = await res.json();
      if (Array.isArray(data.stops)) setStops(data.stops);
    } catch { /* ignore */ }
  }, [stopsProp.length]);

  useEffect(() => {
    fetchVehicles();
    fetchStops();
  }, [fetchVehicles, fetchStops]);

  // Auto-refresh vehicles every 15 seconds
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(fetchVehicles, 15000);
    return () => clearInterval(id);
  }, [isLive, fetchVehicles]);

  // Get user location if not passed from parent
  useEffect(() => {
    if (userLocation || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true }
    );
  }, [userLocation]);

  // Handle external stop jump (from StopsTab / FavoritesTab)
  useEffect(() => {
    if (jumpToStop) {
      setSelectedStop(jumpToStop);
      setShowNearbyPanel(false);
      onJumpToStopHandled?.();
    }
  }, [jumpToStop, onJumpToStopHandled]);

  const handleStopClick = useCallback((stop: Stop) => {
    setSelectedStop(stop);
    setShowNearbyPanel(false);
  }, []);

  const handleVehicleClick = useCallback(async (vehicle: Vehicle) => {
    if (!vehicle.routeId) return;
    try {
      const res = await fetch(`/api/line-route?routeId=${encodeURIComponent(vehicle.routeId)}`);
      const data = await res.json();
      if (data.geometry && data.geometry.length > 1) {
        setVehicleRouteCoords(data.geometry);
        setVehicleRouteLine(data.line ?? null);
        setSelectedStop(null);
        setShowNearbyPanel(false);
      }
    } catch { /* ignore */ }
  }, []);

  const filteredVehicles = filter === 'all' ? vehicles : vehicles.filter((v) => v.type === filter);

  const counts = vehicles.reduce(
    (acc, v) => ({ ...acc, [v.type]: (acc[v.type] ?? 0) + 1 }),
    {} as Record<VehicleType, number>
  );

  // Nearest stops sorted by distance to user
  const nearbyStops = userLocation
    ? [...stops]
        .map((s) => ({ stop: s, dist: distanceM(userLocation[0], userLocation[1], s.lat, s.lng) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 8)
    : [];

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Map takes full height — isolate creates a stacking context so Leaflet's
          internal compositing (mix-blend-mode on tiles, will-change on panes)
          cannot escape and cover the React overlays above */}
      <div className="absolute inset-0 isolate">
        <MapComponent
          vehicles={filteredVehicles}
          stops={stops}
          showVehicles={showVehicles}
          showStops={showStops}
          stopFilter={filter}
          selectedStop={selectedStop}
          routeCoords={routeCoords}
          vehicleRouteCoords={vehicleRouteCoords}
          userLocation={userLocation}
          onStopClick={handleStopClick}
          onVehicleClick={handleVehicleClick}
          centerOnUser={centerOnUser}
        />
      </div>

      {/* Top controls overlay — z-30 keeps it above the stop panel (z-20) */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 pointer-events-none">
        <div className="pointer-events-auto">
          <VehicleFilter active={filter} onChange={setFilter} counts={counts} />
        </div>

        <div className="flex items-center gap-2 mt-2 pointer-events-auto">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm backdrop-blur-sm ${
              isLive
                ? 'bg-green-500/90 text-white'
                : 'bg-white/90 text-gray-600 border border-gray-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
            {isLive ? 'Live' : 'Paused'}
          </button>
          {lastUpdate && (
            <span className="text-[11px] text-gray-600 bg-white/85 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm border border-white/60">
              {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Clear route banner */}
      {routeCoords && routeCoords.length > 1 && onClearRoute && (
        <div className="absolute top-[72px] left-3 right-3 z-30 flex justify-center pointer-events-none">
          <button
            onClick={onClearRoute}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md border border-gray-200 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear route
          </button>
        </div>
      )}

      {/* Clear vehicle line route banner */}
      {vehicleRouteCoords && vehicleRouteCoords.length > 1 && (
        <div className="absolute top-[72px] left-3 right-3 z-30 flex justify-center pointer-events-none">
          <button
            onClick={() => { setVehicleRouteCoords(undefined); setVehicleRouteLine(null); }}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-full shadow-md text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {vehicleRouteLine ? `${vehicleRouteLine.name} route` : 'Clear line'}
          </button>
        </div>
      )}

      {/* Right side FAB buttons */}
      <div className="absolute right-3 bottom-24 z-30 flex flex-col gap-2">
        {/* My location */}
        <button
          onClick={() => { setCenterOnUser(true); setTimeout(() => setCenterOnUser(false), 100); }}
          className="w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all border border-gray-100"
          title={t('map.centerLocation')}
        >
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
          </svg>
        </button>

        {/* Nearest stop button — visible when user has location */}
        {userLocation && stops.length > 0 && (
          <button
            onClick={() => { setShowNearbyPanel((v) => !v); setSelectedStop(null); }}
            className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all border ${
              showNearbyPanel
                ? 'bg-amber-500 text-white border-amber-400'
                : 'bg-white text-amber-600 border-gray-100 hover:bg-amber-50'
            }`}
            title="Nearest stops"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}

        {/* Toggle vehicles */}
        <button
          onClick={() => setShowVehicles(!showVehicles)}
          className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all border ${
            showVehicles
              ? 'bg-blue-600 text-white border-blue-500'
              : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'
          }`}
          title={showVehicles ? t('map.hideVehicles') : t('map.showVehicles')}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0v4m-4 4v2m-6 2h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
        </button>

        {/* Toggle stops */}
        <button
          onClick={() => setShowStops(!showStops)}
          className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all border ${
            showStops
              ? 'bg-slate-600 text-white border-slate-500'
              : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'
          }`}
          title={t('map.stops')}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
          </svg>
        </button>
      </div>

      {/* Nearest stops bottom sheet */}
      {showNearbyPanel && nearbyStops.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 max-h-[55vh] flex flex-col">
          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-center justify-between px-4 py-2">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Nearest stops
            </h3>
            <button onClick={() => setShowNearbyPanel(false)} className="p-1.5 rounded-full hover:bg-gray-100">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-2">
            {nearbyStops.map(({ stop, dist }) => (
              <button
                key={stop.id}
                onClick={() => { setSelectedStop(stop); setShowNearbyPanel(false); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-amber-50 hover:border-amber-200 border border-transparent transition-all text-left"
              >
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{stop.name}</p>
                  {stop.code && <p className="text-xs text-gray-500">{t('stop.code')}: {stop.code}</p>}
                </div>
                <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex-shrink-0">
                  {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stop arrivals bottom sheet */}
      {selectedStop && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <StopArrivals stop={selectedStop} onClose={() => setSelectedStop(null)} />
        </div>
      )}
    </div>
  );
}
