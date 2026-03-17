'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import RoutesTab from '@/components/RoutesTab';
import StopsTab from '@/components/StopsTab';
import FavoritesTab from '@/components/FavoritesTab';
import type { Stop, TransitRouteResult, SearchResult } from '@/lib/types';

// Lazy load the heavy map tab
const MapTab = dynamic(() => import('@/components/MapTab'), { ssr: false });

type Tab = 'map' | 'routes' | 'stops' | 'favorites';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [walkRouteCoords, setWalkRouteCoords] = useState<[number, number][][]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [jumpToStop, setJumpToStop] = useState<Stop | null>(null);
  const [activeNavigation, setActiveNavigation] = useState<{
    route: TransitRouteResult; destName: string; destLat: number; destLng: number;
  } | null>(null);

  // Fetch stops once
  useEffect(() => {
    fetch('/api/stops')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.stops)) setStops(d.stops); })
      .catch(() => {});
  }, []);

  // Get user location once
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true }
    );
  }, []);

  const handleRouteFound = useCallback((coords: [number, number][]) => {
    setRouteCoords(coords);
  }, []);

  const handleWalkGeometryFound = useCallback((walkGeo: [number, number][][]) => {
    setWalkRouteCoords(walkGeo);
  }, []);

  const handleClearRoute = useCallback(() => {
    setRouteCoords([]);
    setWalkRouteCoords([]);
  }, []);

  // When user selects a stop from any tab, jump to it on the map
  const handleStopSelect = useCallback((stop: Stop) => {
    setJumpToStop(stop);
    setActiveTab('map');
  }, []);

  const handleStartNavigation = useCallback((route: TransitRouteResult, dest: SearchResult) => {
    setActiveNavigation({ route, destName: dest.name, destLat: dest.lat, destLng: dest.lng });
    setRouteCoords(route.geometry);
    setWalkRouteCoords(route.walkGeometry ?? []);
    setActiveTab('map');
  }, []);

  return (
    <main className="fixed inset-0 flex flex-col bg-gray-50">
      <Header />

      {/* Content area between header (52px) and bottom nav (60px) */}
      <div className="absolute inset-0 top-[52px] bottom-[60px]">
        {/* Map tab always mounted */}
        <div className={`absolute inset-0 ${activeTab === 'map' ? 'z-10' : 'z-0 pointer-events-none opacity-0'}`}>
          <MapTab
            routeCoords={routeCoords}
            walkPolylines={walkRouteCoords}
            onClearRoute={handleClearRoute}
            jumpToStop={jumpToStop}
            onJumpToStopHandled={() => setJumpToStop(null)}
            stops={stops}
            userLocation={userLocation}
            activeNavigation={activeNavigation}
            onEndNavigation={() => { setActiveNavigation(null); handleClearRoute(); }}
          />
        </div>

        {/* Routes tab */}
        {activeTab === 'routes' && (
          <div className="absolute inset-0 z-10 overflow-y-auto bg-gray-50">
            <RoutesTab
              onRouteFound={handleRouteFound}
              onWalkGeometryFound={handleWalkGeometryFound}
              onClearRoute={handleClearRoute}
              onShowOnMap={() => setActiveTab('map')}
              onStartNavigation={handleStartNavigation}
            />
          </div>
        )}

        {/* Stops tab */}
        {activeTab === 'stops' && (
          <div className="absolute inset-0 z-10 bg-gray-50 flex flex-col">
            <StopsTab
              stops={stops}
              onStopSelect={handleStopSelect}
              userLocation={userLocation}
            />
          </div>
        )}

        {/* Favorites tab */}
        {activeTab === 'favorites' && (
          <div className="absolute inset-0 z-10 bg-gray-50 flex flex-col">
            <FavoritesTab onStopSelect={handleStopSelect} />
          </div>
        )}
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
}
