'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { SearchResult, TransitRouteResult, VehicleType } from '@/lib/types';
import { useT } from './TranslationContext';

interface RoutePlannerProps {
  onRouteFound: (coords: [number, number][]) => void;
  onClearRoute: () => void;
  onFromChange?: (result: SearchResult | null) => void;
  onToChange?: (result: SearchResult | null) => void;
  userLocation?: [number, number] | null;
  onStartNavigation?: (route: TransitRouteResult, dest: SearchResult) => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const TYPE_COLORS: Record<VehicleType, string> = {
  bus: 'bg-blue-600',
  tram: 'bg-red-600',
  trolley: 'bg-green-700',
  metro: 'bg-purple-700',
};

const TYPE_ICONS: Record<VehicleType, string> = {
  bus: '🚌',
  tram: '🚊',
  trolley: '🚎',
  metro: '🚇',
};

export default function RoutePlanner({
  onRouteFound,
  onClearRoute,
  onFromChange,
  onToChange,
  userLocation,
  onStartNavigation,
}: RoutePlannerProps) {
  const { t } = useT();
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromResult, setFromResult] = useState<SearchResult | null>(null);
  const [toResult, setToResult] = useState<SearchResult | null>(null);
  const [fromSuggestions, setFromSuggestions] = useState<SearchResult[]>([]);
  const [toSuggestions, setToSuggestions] = useState<SearchResult[]>([]);
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [searching, setSearching] = useState(false);
  const [transitRoutes, setTransitRoutes] = useState<TransitRouteResult[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<TransitRouteResult | null>(null);
  const [expandedStops, setExpandedStops] = useState<string | null>(null);
  const [noRoute, setNoRoute] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedFrom = useDebounce(fromText, 400);
  const debouncedTo   = useDebounce(toText, 400);

  const geocode = useCallback(async (q: string): Promise<SearchResult[]> => {
    if (!q.trim() || q.length < 2) return [];
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      return data.results ?? [];
    } catch { return []; }
  }, []);

  useEffect(() => {
    if (!debouncedFrom || fromResult) return;
    geocode(debouncedFrom).then(setFromSuggestions);
  }, [debouncedFrom, fromResult, geocode]);

  useEffect(() => {
    if (!debouncedTo || toResult) return;
    geocode(debouncedTo).then(setToSuggestions);
  }, [debouncedTo, toResult, geocode]);

  const clearResults = useCallback(() => {
    setTransitRoutes([]);
    setSelectedRoute(null);
    setNoRoute(false);
    onClearRoute();
  }, [onClearRoute]);

  const handleSearch = useCallback(async () => {
    if (!fromResult && !userLocation) return;
    if (!toResult) return;

    const fromLat = fromResult?.lat ?? userLocation?.[0];
    const fromLng = fromResult?.lng ?? userLocation?.[1];
    if (!fromLat || !fromLng) return;

    setSearching(true);
    setTransitRoutes([]);
    setSelectedRoute(null);
    setNoRoute(false);
    onClearRoute();

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      const url = `/api/routes?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toResult.lat}&toLng=${toResult.lng}`;
      const res  = await fetch(url, { signal: abortRef.current.signal });
      const data = await res.json();

      if (data.transitRoutes?.length > 0) {
        setTransitRoutes(data.transitRoutes);
        const best = data.transitRoutes[0] as TransitRouteResult;
        setSelectedRoute(best);
        if (best.geometry.length > 1) onRouteFound(best.geometry);
      } else {
        setNoRoute(true);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Route search error:', err);
        setNoRoute(true);
      }
    } finally {
      setSearching(false);
    }
  }, [fromResult, toResult, userLocation, onRouteFound, onClearRoute]);

  const selectRoute = useCallback(
    (route: TransitRouteResult) => {
      setSelectedRoute(route);
      if (route.geometry.length > 1) onRouteFound(route.geometry);
    },
    [onRouteFound],
  );

  const setUseMyLocation = useCallback(() => {
    if (!userLocation) return;
    setFromText(t('search.myLocation'));
    const r: SearchResult = { id: 'user', name: t('search.myLocation'), lat: userLocation[0], lng: userLocation[1], type: 'place' };
    setFromResult(r);
    setFromSuggestions([]);
    onFromChange?.(r);
  }, [userLocation, t, onFromChange]);

  const handleFromClear = () => { setFromText(''); setFromResult(null); setFromSuggestions([]); onFromChange?.(null); clearResults(); };
  const handleToClear   = () => { setToText('');   setToResult(null);   setToSuggestions([]);   onToChange?.(null);   clearResults(); };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 space-y-3">
      {/* From field */}
      <div className="relative">
        <label className="block text-xs font-semibold text-gray-500 mb-1">{t('search.from')}</label>
        <div className="relative">
          <input
            type="text"
            value={fromText}
            onChange={(e) => { setFromText(e.target.value); setFromResult(null); onFromChange?.(null); }}
            onFocus={() => setActiveField('from')}
            onBlur={() => setTimeout(() => setActiveField(null), 200)}
            placeholder={t('search.fromPlaceholder')}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          {fromText && <button onClick={handleFromClear} className="absolute right-2 top-2 p-1 text-gray-400 hover:text-gray-600">✕</button>}
        </div>
        {userLocation && !fromResult && (
          <button onClick={setUseMyLocation} className="mt-1 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <span>📍</span> {t('search.myLocation')}
          </button>
        )}
        {activeField === 'from' && fromSuggestions.length > 0 && (
          <SuggestionList results={fromSuggestions} onSelect={(r) => {
            setFromText(r.name); setFromResult(r); setFromSuggestions([]); onFromChange?.(r);
          }} />
        )}
      </div>

      {/* Swap */}
      <button
        onClick={() => {
          const tmpText = fromText; setFromText(toText); setToText(tmpText);
          const tmpResult = fromResult; setFromResult(toResult); setToResult(tmpResult);
          onFromChange?.(toResult); onToChange?.(fromResult);
          clearResults();
        }}
        className="absolute right-8 -mt-1 z-10 p-1.5 bg-white rounded-full border border-gray-200 shadow-sm hover:bg-gray-50"
      >
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      </button>

      {/* To field */}
      <div className="relative">
        <label className="block text-xs font-semibold text-gray-500 mb-1">{t('search.to')}</label>
        <div className="relative">
          <input
            type="text"
            value={toText}
            onChange={(e) => { setToText(e.target.value); setToResult(null); onToChange?.(null); }}
            onFocus={() => setActiveField('to')}
            onBlur={() => setTimeout(() => setActiveField(null), 200)}
            placeholder={t('search.toPlaceholder')}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
          {toText && <button onClick={handleToClear} className="absolute right-2 top-2 p-1 text-gray-400 hover:text-gray-600">✕</button>}
        </div>
        {activeField === 'to' && toSuggestions.length > 0 && (
          <SuggestionList results={toSuggestions} onSelect={(r) => {
            setToText(r.name); setToResult(r); setToSuggestions([]); onToChange?.(r);
          }} />
        )}
      </div>

      {/* Search button */}
      <button
        onClick={handleSearch}
        disabled={searching || (!fromResult && !userLocation) || !toResult}
        className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        style={{ background: '#003DA5' }}
      >
        {searching ? (
          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('search.searching')}</>
        ) : (
          <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>{t('search.search')}</>
        )}
      </button>

      {/* No route */}
      {noRoute && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 text-center">
          No transit route found between these locations.
        </div>
      )}

      {/* Results */}
      {transitRoutes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase" style={{ letterSpacing: '0.06em' }}>
              {transitRoutes.length} route{transitRoutes.length !== 1 ? 's' : ''} found
            </p>
            <button onClick={clearResults} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
              ✕ Clear route
            </button>
          </div>

          {transitRoutes.map((route, i) => {
            const routeKey = `${route.type}:${route.line}:${i}`;
            const isSelected = !!(selectedRoute && selectedRoute.line === route.line && selectedRoute.type === route.type);
            const isExpanded = expandedStops === routeKey;
            const walkToMin   = Math.max(1, Math.round(route.walkToStop   / 80));
            const walkFromMin = Math.max(1, Math.round(route.walkFromStop / 80));

            return (
              <div
                key={routeKey}
                className={`rounded-xl border-2 overflow-hidden transition-colors cursor-pointer ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => selectRoute(route)}
              >
                <div className="p-3 space-y-2">
                  {/* Line badges + transfer indicator */}
                  <div className="flex items-center gap-2">
                    <LineBadge type={route.type} line={route.line} />
                    {route.isTransfer && route.line2 && route.type2 && (
                      <>
                        <span className="text-gray-400 text-sm font-bold">→</span>
                        <LineBadge type={route.type2} line={route.line2} />
                        <span className="ml-1 text-xs text-orange-600 font-semibold bg-orange-50 px-1.5 py-0.5 rounded-full">1 transfer</span>
                      </>
                    )}
                    <span className="ml-auto text-sm font-bold text-blue-700">~{route.duration} min</span>
                  </div>

                  {/* Steps summary */}
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <span>🚶</span>
                      <span>{walkToMin} min walk → <strong className="text-gray-800">{route.boardStop.name}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>{TYPE_ICONS[route.type]}</span>
                      <span>{route.numStops} stops → <strong className="text-gray-800">{route.alightStop.name}</strong></span>
                    </div>
                    {route.isTransfer && route.line2 && route.type2 && route.boardStop2 && route.alightStop2 && (
                      <>
                        <div className="flex items-center gap-1.5 pl-3 border-l-2 border-orange-300">
                          <span>🔄</span>
                          <span>Transfer → board <strong className="text-gray-800">{route.type2} {route.line2}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>{TYPE_ICONS[route.type2]}</span>
                          <span>{route.numStops2} stops → <strong className="text-gray-800">{route.alightStop2.name}</strong></span>
                        </div>
                      </>
                    )}
                    {walkFromMin > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span>🚶</span>
                        <span>{walkFromMin} min walk to destination</span>
                      </div>
                    )}
                  </div>

                  {/* Navigate button (only on selected route) */}
                  {isSelected && onStartNavigation && toResult && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onStartNavigation(route, toResult); }}
                      className="w-full mt-1 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-blue-700 active:bg-blue-800 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Start Navigation
                    </button>
                  )}
                </div>

                {/* Expand stops */}
                <button
                  className="w-full px-3 py-2 bg-gray-50 text-xs text-blue-600 font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
                  onClick={(e) => { e.stopPropagation(); setExpandedStops(isExpanded ? null : routeKey); }}
                >
                  {isExpanded ? '▲ Hide stops' : `▼ Show stops`}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 bg-gray-50 max-h-48 overflow-y-auto">
                    {/* Leg 1 stops */}
                    {route.stops.map((stop, si) => (
                      <div key={stop.id || si} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${si === 0 ? 'bg-green-500' : si === route.stops.length - 1 ? (route.isTransfer ? 'bg-orange-400' : 'bg-red-500') : 'bg-gray-400'}`} />
                        <span className="text-xs text-gray-700">{stop.name}</span>
                        {stop.code && <span className="text-xs text-gray-400 ml-auto">{stop.code}</span>}
                      </div>
                    ))}
                    {/* Leg 2 stops */}
                    {route.isTransfer && route.stops2?.map((stop, si) => (
                      <div key={`leg2-${stop.id || si}`} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${si === 0 ? 'bg-orange-400' : si === (route.stops2!.length - 1) ? 'bg-red-500' : 'bg-gray-300'}`} />
                        <span className="text-xs text-gray-500 italic">{stop.name}</span>
                        {stop.code && <span className="text-xs text-gray-400 ml-auto">{stop.code}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LineBadge({ type, line }: { type: VehicleType; line: string }) {
  return (
    <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${TYPE_COLORS[type]} flex flex-col items-center justify-center`}>
      <span className="text-white text-base leading-none">{TYPE_ICONS[type]}</span>
      <span className="text-white text-xs font-bold leading-none mt-0.5">{line}</span>
    </div>
  );
}

function SuggestionList({ results, onSelect }: { results: SearchResult[]; onSelect: (r: SearchResult) => void }) {
  return (
    <ul className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      {results.slice(0, 4).map((r) => (
        <li key={r.id}>
          <button
            onMouseDown={() => onSelect(r)}
            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-start gap-2"
          >
            <span className="text-gray-400 mt-0.5 flex-shrink-0">📍</span>
            <span className="text-sm text-gray-700 line-clamp-2">{r.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
