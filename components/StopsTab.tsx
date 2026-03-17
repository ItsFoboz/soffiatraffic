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
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>

      {/* Page header */}
      <div className="px-4 pt-5 pb-2">
        <h2
          className="font-bold mb-3 flex items-center gap-2"
          style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text-primary)' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-primary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {t('nav.stops')}
        </h2>

        {/* Pill search bar */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.stopSearch')}
            className="w-full"
            style={{
              height: '44px',
              borderRadius: 'var(--radius-full)',
              border: '1.5px solid var(--color-border)',
              background: 'var(--color-surface)',
              padding: '0 40px 0 40px',
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              boxShadow: 'var(--shadow-sm)',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--color-primary)';
              e.target.style.boxShadow = '0 0 0 3px rgba(26,86,219,0.12)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--color-border)';
              e.target.style.boxShadow = 'var(--shadow-sm)';
            }}
          />
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            style={{ color: 'var(--color-text-muted)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Sorted by distance label */}
        {userLocation && !query && (
          <p
            className="flex items-center gap-1.5 mt-2 px-1"
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-primary)' }}>
              <circle cx="12" cy="12" r="3" fill="currentColor" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
            </svg>
            Sorted by distance from your location
          </p>
        )}

        {/* Icon legend */}
        <p
          className="flex items-center gap-3 mt-2 px-1"
          style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}
        >
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-warning)' }} />
            Live data available
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300" />
            No live data
          </span>
        </p>
      </div>

      {/* Stop list */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--color-surface)' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--color-text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{t('search.noResults')}</p>
          </div>
        ) : (
          filtered.map((stop) => {
            const dist = userLocation
              ? Math.round(distance(userLocation[0], userLocation[1], stop.lat, stop.lng))
              : null;
            const isClose    = dist !== null && dist < 300;
            const isNearby   = dist !== null && dist < 500;
            const hasLiveData = isClose; // yellow = close = likely has live data

            return (
              <button
                key={stop.id}
                onClick={() => onStopSelect(stop)}
                className="w-full flex items-center gap-3 text-left"
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)'; }}
              >
                {/* Stop icon: yellow = live data, grey = no live data */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: hasLiveData ? 'rgba(245,158,11,0.15)' : 'var(--color-bg)',
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: hasLiveData ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>

                {/* Name + code */}
                <div className="flex-1 min-w-0">
                  <p
                    className="truncate tracking-[0.01em]"
                    style={{
                      fontSize: 'var(--font-size-base)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {stop.name}
                  </p>
                  {stop.code && (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {t('stop.code')}: {stop.code}
                    </p>
                  )}
                </div>

                {/* Distance badge — amber ≤300m, grey >300m */}
                {dist !== null && (
                  <span
                    className="flex-shrink-0 rounded-full px-2 py-0.5"
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-medium)',
                      background: isClose ? 'rgba(245,158,11,0.12)' : '#9CA3AF',
                      color: isClose ? '#b45309' : 'white',
                    }}
                  >
                    {dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`}
                  </span>
                )}

                {/* Chevron */}
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-text-muted)' }}>
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
