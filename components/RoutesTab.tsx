'use client';

import { useState, useEffect } from 'react';
import RoutePlanner from './RoutePlanner';
import type { SearchResult, TransitRouteResult } from '@/lib/types';
import { useT } from './TranslationContext';

interface RoutesTabProps {
  onRouteFound: (coords: [number, number][]) => void;
  onClearRoute: () => void;
  onShowOnMap: () => void;
  onStartNavigation?: (route: TransitRouteResult, dest: SearchResult) => void;
}

const TRANSPORT_TYPES = [
  { key: 'bus',     emoji: '🚌', labelKey: 'vehicle.bus',     color: 'var(--color-bus)'     },
  { key: 'tram',    emoji: '🚊', labelKey: 'vehicle.tram',    color: 'var(--color-tram)'    },
  { key: 'trolley', emoji: '🚎', labelKey: 'vehicle.trolley', color: 'var(--color-trolley)' },
  { key: 'metro',   emoji: '🚇', labelKey: 'vehicle.metro',   color: 'var(--color-metro)'   },
];

export default function RoutesTab({ onRouteFound, onClearRoute, onShowOnMap, onStartNavigation }: RoutesTabProps) {
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

  const handleRouteFound = (coords: [number, number][]) => { onRouteFound(coords); setHasRoute(true); };
  const handleClearRoute = () => { onClearRoute(); setHasRoute(false); };

  return (
    <div className="flex flex-col min-h-full" style={{ background: 'var(--color-bg)' }}>

      {/* Page header */}
      <div className="px-5 pt-5 pb-3">
        <h2
          className="font-bold flex items-center gap-2"
          style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text-primary)' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-primary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          {t('nav.routes')}
        </h2>
      </div>

      {/* Route planner search card */}
      <div className="px-4">
        <RoutePlanner
          onRouteFound={handleRouteFound}
          onClearRoute={handleClearRoute}
          userLocation={userLocation}
          onFromChange={(_r: SearchResult | null) => { setHasRoute(false); }}
          onToChange={(_r: SearchResult | null) => { setHasRoute(false); }}
          onStartNavigation={onStartNavigation}
        />
      </div>

      {/* Show on map button */}
      {hasRoute && (
        <div className="px-4 mt-3">
          <button
            onClick={onShowOnMap}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl"
            style={{
              border: '1.5px solid var(--color-primary)',
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <span>🗺️</span>
            View on map
          </button>
        </div>
      )}

      {/* Transport types section */}
      <div className="px-5 mt-6 mb-1">
        <p
          className="uppercase tracking-wider"
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-secondary)',
            letterSpacing: '0.06em',
          }}
        >
          Sofia Public Transport
        </p>
      </div>
      <div className="px-4 grid grid-cols-2 gap-2 mb-6">
        {TRANSPORT_TYPES.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-3 p-4"
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Colored icon circle */}
            <div
              className="flex items-center justify-center flex-shrink-0 text-xl"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: item.color + '1a',
              }}
            >
              {item.emoji}
            </div>
            <span
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
              }}
            >
              {t(item.labelKey)}
            </span>
          </div>
        ))}
      </div>

      {/* Recent routes — empty state */}
      <div className="px-5 mb-2">
        <p
          className="uppercase tracking-wider"
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-secondary)',
            letterSpacing: '0.06em',
          }}
        >
          Recent routes
        </p>
      </div>
      <div
        className="mx-4 mb-4 flex flex-col items-center justify-center py-8 rounded-xl"
        style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}
      >
        <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--color-text-muted)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>No recent routes</p>
      </div>

      {/* Attribution */}
      <div
        className="mx-4 mb-4 p-4 rounded-xl flex items-start gap-1.5"
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
      >
        <span className="flex-shrink-0 mt-0.5">ℹ️</span>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          Data by{' '}
          <a href="https://www.sofiatraffic.bg/bg" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>
            sofiatraffic.bg
          </a>
          {' '}· Map by{' '}
          <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>
            OpenStreetMap
          </a>
        </p>
      </div>
    </div>
  );
}
