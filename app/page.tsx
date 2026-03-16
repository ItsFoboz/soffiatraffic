'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import RoutesTab from '@/components/RoutesTab';
import StopsTab from '@/components/StopsTab';
import FavoritesTab from '@/components/FavoritesTab';
import type { Stop } from '@/lib/types';

// Lazy load the heavy map tab
const MapTab = dynamic(() => import('@/components/MapTab'), { ssr: false });

type Tab = 'map' | 'routes' | 'stops' | 'favorites';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [stops, setStops] = useState<Stop[]>([]);

  // Fetch stops once for the stops tab
  useEffect(() => {
    fetch('/api/stops')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.stops)) setStops(d.stops); })
      .catch(() => {});
  }, []);

  const handleRouteFound = useCallback((coords: [number, number][]) => {
    setRouteCoords(coords);
  }, []);

  const handleStopSelect = useCallback((_stop: Stop) => {
    setActiveTab('map');
  }, []);

  return (
    <main className="fixed inset-0 flex flex-col bg-gray-50">
      <Header />

      {/* Content area between header (56px) and bottom nav (64px) */}
      <div className="absolute inset-0 top-[56px] bottom-[64px]">
        {/* Map tab always mounted */}
        <div className={`absolute inset-0 ${activeTab === 'map' ? 'z-10' : 'z-0 pointer-events-none opacity-0'}`}>
          <MapTab routeCoords={routeCoords} />
        </div>

        {/* Routes tab */}
        {activeTab === 'routes' && (
          <div className="absolute inset-0 z-10 overflow-y-auto bg-gray-50">
            <RoutesTab
              onRouteFound={handleRouteFound}
              onShowOnMap={() => setActiveTab('map')}
            />
          </div>
        )}

        {/* Stops tab */}
        {activeTab === 'stops' && (
          <div className="absolute inset-0 z-10 bg-gray-50 flex flex-col">
            <StopsTab
              stops={stops}
              onStopSelect={handleStopSelect}
            />
          </div>
        )}

        {/* Favorites tab */}
        {activeTab === 'favorites' && (
          <div className="absolute inset-0 z-10 bg-gray-50 flex flex-col">
            <FavoritesTab />
          </div>
        )}
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
}
