'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Vehicle, Stop, VehicleType, TransitRouteResult } from '@/lib/types';
import { useT } from './TranslationContext';
import VehicleFilter from './VehicleFilter';
import StopArrivals from './StopArrivals';
import NavigationPanel from './NavigationPanel';

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        <p className="text-sm text-gray-500">Loading map…</p>
      </div>
    </div>
  ),
});

type FilterOption = 'all' | VehicleType;
type MapStyle = 'light' | 'dark';

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ActiveNavigation {
  route: TransitRouteResult;
  destName: string;
  destLat: number;
  destLng: number;
}

interface MapTabProps {
  routeCoords?: [number, number][];
  onClearRoute?: () => void;
  jumpToStop?: Stop | null;
  onJumpToStopHandled?: () => void;
  stops?: Stop[];
  userLocation?: [number, number] | null;
  activeNavigation?: ActiveNavigation | null;
  onEndNavigation?: () => void;
}

export default function MapTab({
  routeCoords,
  onClearRoute,
  jumpToStop,
  onJumpToStopHandled,
  stops: stopsProp = [],
  userLocation: userLocationProp = null,
  activeNavigation,
  onEndNavigation,
}: MapTabProps) {
  const { t } = useT();
  const [vehicles, setVehicles]             = useState<Vehicle[]>([]);
  const [stops, setStops]                   = useState<Stop[]>(stopsProp);
  const [filter, setFilter]                 = useState<FilterOption>('all');
  const [showVehicles, setShowVehicles]     = useState(true);
  const [showStops, setShowStops]           = useState(true);
  const [selectedStop, setSelectedStop]     = useState<Stop | null>(null);
  const [userLocation, setUserLocation]     = useState<[number, number] | null>(userLocationProp);
  const [centerOnUser, setCenterOnUser]     = useState(false);
  const [isLive, setIsLive]                 = useState(true);
  const [lastUpdate, setLastUpdate]         = useState<Date | null>(null);
  const [showNearbyPanel, setShowNearbyPanel] = useState(false);
  const [vehicleRouteCoords, setVehicleRouteCoords] = useState<[number, number][] | undefined>();
  const [vehicleRouteLine, setVehicleRouteLine] = useState<{ name: string; type: VehicleType } | null>(null);
  const [mapStyle, setMapStyle]             = useState<MapStyle>('light');

  // Zoom controls exposed from MapComponent via onMapReady
  const zoomInRef  = useRef<(() => void) | null>(null);
  const zoomOutRef = useRef<(() => void) | null>(null);
  const handleMapReady = useCallback(
    (controls: { zoomIn(): void; zoomOut(): void }) => {
      zoomInRef.current  = controls.zoomIn;
      zoomOutRef.current = controls.zoomOut;
    }, []
  );

  const fetchingRef = useRef(false);

  useEffect(() => { if (stopsProp.length) setStops(stopsProp); }, [stopsProp]);
  useEffect(() => { if (userLocationProp) setUserLocation(userLocationProp); }, [userLocationProp]);

  const fetchVehicles = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res  = await fetch('/api/vehicles');
      const data = await res.json();
      if (Array.isArray(data.vehicles)) { setVehicles(data.vehicles); setLastUpdate(new Date()); }
    } catch { /* silently fail on background refresh */ }
    finally { fetchingRef.current = false; }
  }, []);

  const fetchStops = useCallback(async () => {
    if (stopsProp.length) return;
    try {
      const res  = await fetch('/api/stops');
      const data = await res.json();
      if (Array.isArray(data.stops)) setStops(data.stops);
    } catch { /* ignore */ }
  }, [stopsProp.length]);

  useEffect(() => { fetchVehicles(); fetchStops(); }, [fetchVehicles, fetchStops]);
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(fetchVehicles, 15000);
    return () => clearInterval(id);
  }, [isLive, fetchVehicles]);

  useEffect(() => {
    if (userLocation || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true }
    );
  }, [userLocation]);

  useEffect(() => {
    if (jumpToStop) { setSelectedStop(jumpToStop); setShowNearbyPanel(false); onJumpToStopHandled?.(); }
  }, [jumpToStop, onJumpToStopHandled]);

  const handleStopClick = useCallback((stop: Stop) => {
    setSelectedStop(stop); setShowNearbyPanel(false);
  }, []);

  const handleVehicleClick = useCallback(async (vehicle: Vehicle) => {
    if (!vehicle.routeId) return;
    try {
      const res  = await fetch(`/api/line-route?routeId=${encodeURIComponent(vehicle.routeId)}`);
      const data = await res.json();
      if (data.geometry && data.geometry.length > 1) {
        setVehicleRouteCoords(data.geometry);
        setVehicleRouteLine(data.line ?? null);
        setSelectedStop(null); setShowNearbyPanel(false);
      }
    } catch { /* ignore */ }
  }, []);

  const filteredVehicles = filter === 'all' ? vehicles : vehicles.filter((v) => v.type === filter);
  const counts = vehicles.reduce(
    (acc, v) => ({ ...acc, [v.type]: (acc[v.type] ?? 0) + 1 }),
    {} as Record<VehicleType, number>
  );

  const nearbyStops = userLocation
    ? [...stops]
        .map((s) => ({ stop: s, dist: distanceM(userLocation[0], userLocation[1], s.lat, s.lng) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 8)
    : [];

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Map fills full area — isolate prevents Leaflet from leaking above React overlays */}
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
          followUser={!!activeNavigation}
          mapStyle={mapStyle}
          onMapReady={handleMapReady}
        />
      </div>

      {/* Top controls overlay */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 pointer-events-none">
        <div className="pointer-events-auto">
          <VehicleFilter active={filter} onChange={setFilter} counts={counts} />
        </div>

        {/* Live indicator pill */}
        <div
          className="flex items-center gap-1.5 mt-2 pointer-events-auto"
          style={{
            display: 'inline-flex',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-full)',
            boxShadow: 'var(--shadow-sm)',
            padding: '4px 10px 4px 8px',
          }}
        >
          <span
            className={isLive ? 'animate-live' : ''}
            style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: isLive ? 'var(--color-live)' : 'var(--color-text-muted)',
              flexShrink: 0,
            }}
          />
          <button
            onClick={() => setIsLive(!isLive)}
            style={{
              fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)', background: 'none', border: 'none',
              cursor: 'pointer', padding: 0,
            }}
          >
            {isLive ? 'Live' : 'Paused'}
          </button>
          {lastUpdate && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
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

      {/* ── Controls card — single grouped card, right side ─────────────── */}
      <div className="absolute right-3 bottom-24 z-20" style={{ borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
        <div className="flex flex-col bg-white" style={{ width: '44px' }}>

          {/* Zoom in */}
          <button
            onClick={() => zoomInRef.current?.()}
            className="h-11 flex items-center justify-center hover:bg-gray-50 active:scale-95"
            title="Zoom in"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <div style={{ height: '1px', background: '#E5E7EB' }} />

          {/* Zoom out */}
          <button
            onClick={() => zoomOutRef.current?.()}
            className="h-11 flex items-center justify-center hover:bg-gray-50 active:scale-95"
            title="Zoom out"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>

          <div style={{ height: '1px', background: '#E5E7EB' }} />

          {/* My location */}
          <button
            onClick={() => { setCenterOnUser(true); setTimeout(() => setCenterOnUser(false), 100); }}
            className="h-11 flex items-center justify-center hover:bg-gray-50 active:scale-95"
            title={t('map.centerLocation')}
            style={{ color: 'var(--color-primary)' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" fill="currentColor" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
            </svg>
          </button>

          {/* Nearest stops — only when location is known */}
          {userLocation && stops.length > 0 && (
            <>
              <div style={{ height: '1px', background: '#E5E7EB' }} />
              <button
                onClick={() => { setShowNearbyPanel((v) => !v); setSelectedStop(null); }}
                className="h-11 flex items-center justify-center hover:bg-amber-50 active:scale-95"
                title="Nearest stops"
                style={{ color: showNearbyPanel ? '#D97706' : '#F59E0B' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </>
          )}

          <div style={{ height: '1px', background: '#E5E7EB' }} />

          {/* Toggle vehicles */}
          <button
            onClick={() => setShowVehicles(!showVehicles)}
            className="h-11 flex items-center justify-center active:scale-95"
            title={showVehicles ? t('map.hideVehicles') : t('map.showVehicles')}
            style={{
              background: showVehicles ? 'var(--color-primary)' : 'white',
              color:      showVehicles ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0v4m-4 4v2m-6 2h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          </button>

          <div style={{ height: '1px', background: '#E5E7EB' }} />

          {/* Toggle stops */}
          <button
            onClick={() => setShowStops(!showStops)}
            className="h-11 flex items-center justify-center active:scale-95"
            title={t('map.stops')}
            style={{
              background: showStops ? '#475569' : 'white',
              color:      showStops ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
            </svg>
          </button>

          <div style={{ height: '1px', background: '#E5E7EB' }} />

          {/* Map style toggle: light ☀ / dark 🌙 */}
          <button
            onClick={() => setMapStyle((s) => (s === 'light' ? 'dark' : 'light'))}
            className="h-11 flex items-center justify-center hover:bg-gray-50 active:scale-95"
            title={mapStyle === 'light' ? 'Switch to dark map' : 'Switch to light map'}
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {mapStyle === 'light' ? (
              /* Moon icon — switching to dark */
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              /* Sun icon — switching to light */
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="5" />
                <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
          </button>

        </div>
      </div>

      {/* Nearest stops bottom sheet */}
      {showNearbyPanel && nearbyStops.length > 0 && (
        <div className="animate-slide-up absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 max-h-[55vh] flex flex-col">
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
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                  style={dist <= 300 ? { background: 'rgba(245,158,11,0.12)', color: '#b45309' } : { background: '#9CA3AF', color: 'white' }}
                >
                  {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stop arrivals bottom sheet */}
      {selectedStop && (
        <div className="animate-slide-up absolute bottom-0 left-0 right-0 z-30">
          <StopArrivals stop={selectedStop} onClose={() => setSelectedStop(null)} />
        </div>
      )}

      {/* Navigation panel */}
      {activeNavigation && onEndNavigation && (
        <NavigationPanel
          route={activeNavigation.route}
          destName={activeNavigation.destName}
          destLat={activeNavigation.destLat}
          destLng={activeNavigation.destLng}
          onEnd={onEndNavigation}
          onGpsUpdate={(lat, lng) => setUserLocation([lat, lng])}
        />
      )}
    </div>
  );
}
