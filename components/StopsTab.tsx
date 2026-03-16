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
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.stopSearch')}
            className="w-full pl-10 pr-8 py-3 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-3 p-0.5 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {userLocation && !query && (
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5 px-1">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" fill="currentColor" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
            </svg>
            Sorted by distance from your location
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-gray-400 text-sm">{t('search.noResults')}</p>
          </div>
        ) : (
          filtered.map((stop) => {
            const dist = userLocation
              ? Math.round(distance(userLocation[0], userLocation[1], stop.lat, stop.lng))
              : null;
            const isClose = dist !== null && dist < 300;
            return (
              <button
                key={stop.id}
                onClick={() => onStopSelect(stop)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-100 hover:border-blue-200 hover:bg-blue-50 active:bg-blue-100 transition-all text-left shadow-sm"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isClose ? 'bg-amber-100' : 'bg-gray-100'}`}>
                  <svg className={`w-4 h-4 ${isClose ? 'text-amber-600' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{stop.name}</p>
                  {stop.code && <p className="text-xs text-gray-400">{t('stop.code')}: {stop.code}</p>}
                </div>
                {dist !== null && (
                  <span className={`text-xs font-medium flex-shrink-0 px-2 py-0.5 rounded-full ${
                    isClose ? 'text-amber-700 bg-amber-100' : 'text-gray-500 bg-gray-100'
                  }`}>
                    {dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`}
                  </span>
                )}
                <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
