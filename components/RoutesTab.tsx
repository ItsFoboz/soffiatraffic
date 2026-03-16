'use client';

import { useState, useEffect } from 'react';
import RoutePlanner from './RoutePlanner';
import type { SearchResult } from '@/lib/types';
import { useT } from './TranslationContext';

interface RoutesTabProps {
  onRouteFound: (coords: [number, number][]) => void;
  onClearRoute: () => void;
  onShowOnMap: () => void;
}

export default function RoutesTab({ onRouteFound, onClearRoute, onShowOnMap }: RoutesTabProps) {
  const { t } = useT();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [hasRoute, setHasRoute] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => {}
    );
  }, []);

  const handleRouteFound = (coords: [number, number][]) => {
    onRouteFound(coords);
    setHasRoute(true);
  };

  const handleClearRoute = () => {
    onClearRoute();
    setHasRoute(false);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>🔀</span>
          <span>{t('nav.routes')}</span>
        </h2>

        <RoutePlanner
          onRouteFound={handleRouteFound}
          onClearRoute={handleClearRoute}
          userLocation={userLocation}
          onFromChange={(_r: SearchResult | null) => { setHasRoute(false); }}
          onToChange={(_r: SearchResult | null) => { setHasRoute(false); }}
        />

        {hasRoute && (
          <button
            onClick={onShowOnMap}
            className="mt-3 w-full py-3 rounded-xl border-2 border-blue-600 text-blue-600 font-semibold text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
          >
            <span>🗺️</span>
            {t('nav.map')}
          </button>
        )}
      </div>

      {/* Info cards */}
      <div className="px-4 pb-4 space-y-3">
        <div className="bg-blue-50 rounded-2xl p-4">
          <h3 className="font-semibold text-blue-900 mb-2 text-sm">Sofia Public Transport</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { emoji: '🚌', label: t('vehicle.bus') },
              { emoji: '🚊', label: t('vehicle.tram') },
              { emoji: '🚎', label: t('vehicle.trolley') },
              { emoji: '🚇', label: t('vehicle.metro') },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 bg-white rounded-xl p-2">
                <span className="text-xl">{item.emoji}</span>
                <span className="text-xs font-medium text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 text-xs text-gray-600">
          <p className="flex items-start gap-1.5">
            <span className="flex-shrink-0 mt-0.5">ℹ️</span>
            <span>
              Data provided by{' '}
              <a href="https://www.sofiatraffic.bg/bg" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                sofiatraffic.bg
              </a>
              {' '}· Map by{' '}
              <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                OpenStreetMap
              </a>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
