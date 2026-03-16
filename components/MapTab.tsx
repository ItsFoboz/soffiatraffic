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
        <p className="text-sm text-gray-500">Loading map...</p>
      </div>
    </div>
  ),
});

type FilterOption = 'all' | VehicleType;

interface MapTabProps {
  routeCoords?: [number, number][];
}

export default function MapTab({ routeCoords }: MapTabProps) {
  const { t } = useT();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [showVehicles, setShowVehicles] = useState(true);
  const [showStops, setShowStops] = useState(true);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [centerOnUser, setCenterOnUser] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const fetchingRef = useRef(false);

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
    try {
      const res = await fetch('/api/stops');
      const data = await res.json();
      if (Array.isArray(data.stops)) setStops(data.stops);
    } catch {
      // ignore
    }
  }, []);

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

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true }
    );
  }, []);

  const filteredVehicles = filter === 'all' ? vehicles : vehicles.filter((v) => v.type === filter);

  const counts = vehicles.reduce(
    (acc, v) => ({ ...acc, [v.type]: (acc[v.type] ?? 0) + 1 }),
    {} as Record<VehicleType, number>
  );

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Map takes full height */}
      <div className="absolute inset-0">
        <MapComponent
          vehicles={filteredVehicles}
          stops={stops}
          showVehicles={showVehicles}
          showStops={showStops}
          selectedStop={selectedStop}
          routeCoords={routeCoords}
          userLocation={userLocation}
          onStopClick={setSelectedStop}
          centerOnUser={centerOnUser}
        />
      </div>

      {/* Top controls overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-3 pointer-events-none">
        {/* Filter chips */}
        <div className="pointer-events-auto">
          <VehicleFilter active={filter} onChange={setFilter} counts={counts} />
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2 mt-2 pointer-events-auto">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              isLive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {t('map.liveTracking')}
          </button>
          {lastUpdate && (
            <span className="text-xs text-gray-500 bg-white/80 px-2 py-1 rounded-full">
              {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Right side buttons */}
      <div className="absolute right-3 bottom-24 z-10 flex flex-col gap-2">
        <button
          onClick={() => { setCenterOnUser(true); setTimeout(() => setCenterOnUser(false), 100); }}
          className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
          title={t('map.centerLocation')}
        >
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          onClick={() => setShowVehicles(!showVehicles)}
          className={`w-10 h-10 rounded-full shadow-md flex items-center justify-center transition-colors ${
            showVehicles ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
          }`}
          title={showVehicles ? t('map.hideVehicles') : t('map.showVehicles')}
        >
          <span className="text-lg">🚌</span>
        </button>
        <button
          onClick={() => setShowStops(!showStops)}
          className={`w-10 h-10 rounded-full shadow-md flex items-center justify-center transition-colors ${
            showStops ? 'bg-amber-500 text-white' : 'bg-white text-gray-600'
          }`}
          title={t('map.stops')}
        >
          <span className="text-lg">🚏</span>
        </button>
      </div>

      {/* Stop arrivals bottom sheet */}
      {selectedStop && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <StopArrivals stop={selectedStop} onClose={() => setSelectedStop(null)} />
        </div>
      )}
    </div>
  );
}
