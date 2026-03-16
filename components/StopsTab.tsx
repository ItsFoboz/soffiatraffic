'use client';

import { useState, useMemo } from 'react';
import type { Stop } from '@/lib/types';
import { useT } from './TranslationContext';

interface StopsTabProps {
  stops: Stop[];
  onStopSelect: (stop: Stop) => void;
  userLocation?: [number, number] | null;
}

function distance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function StopsTab({ stops, onStopSelect, userLocation }: StopsTabProps) {
  const { t } = useT();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let list = q ? stops.filter((s) => s.name.toLowerCase().includes(q) || s.code.includes(q)) : stops;

    if (userLocation && !q) {
      list = [...list].sort((a, b) => {
        const da = distance(userLocation[0], userLocation[1], a.lat, a.lng);
        const db = distance(userLocation[0], userLocation[1], b.lat, b.lng);
        return da - db;
      });
    }

    return list.slice(0, 50);
  }, [stops, query, userLocation]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.stopSearch')}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-2 p-1 text-gray-400">✕</button>
          )}
        </div>
        {userLocation && !query && (
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <span>📍</span> {t('stop.nearbyStops')}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-4">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-8">{t('search.noResults')}</p>
        ) : (
          filtered.map((stop) => {
            const dist = userLocation
              ? Math.round(distance(userLocation[0], userLocation[1], stop.lat, stop.lng))
              : null;
            return (
              <button
                key={stop.id}
                onClick={() => onStopSelect(stop)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left shadow-sm"
              >
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">🚏</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{stop.name}</p>
                  {stop.code && <p className="text-xs text-gray-500">{t('stop.code')}: {stop.code}</p>}
                </div>
                {dist !== null && (
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`}
                  </span>
                )}
                <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
