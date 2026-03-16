'use client';

import { useEffect, useState } from 'react';
import type { Stop, ArrivalTime, VehicleType } from '@/lib/types';
import type { StopLine } from '@/app/api/stop-lines/route';
import { useT } from './TranslationContext';

const TYPE_COLOR: Record<VehicleType, string> = {
  bus: '#2563EB',
  tram: '#DC2626',
  trolley: '#16A34A',
  metro: '#7C3AED',
};

const TYPE_EMOJI: Record<VehicleType, string> = {
  bus: '🚌',
  tram: '🚊',
  trolley: '🚎',
  metro: '🚇',
};

interface LineRouteStop {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
}

interface StopArrivalsProps {
  stop: Stop;
  onClose: () => void;
}

export default function StopArrivals({ stop, onClose }: StopArrivalsProps) {
  const { t } = useT();
  const [tab, setTab] = useState<'arrivals' | 'lines'>('arrivals');

  // Arrivals state
  const [arrivals, setArrivals] = useState<ArrivalTime[]>([]);
  const [arrivalsLoading, setArrivalsLoading] = useState(true);
  const [arrivalsError, setArrivalsError] = useState(false);

  // Lines state
  const [stopLines, setStopLines] = useState<StopLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [linesError, setLinesError] = useState(false);
  const [linesFetched, setLinesFetched] = useState(false);

  // Line detail state
  const [selectedLine, setSelectedLine] = useState<StopLine | null>(null);
  const [lineStops, setLineStops] = useState<LineRouteStop[]>([]);
  const [lineDetailLoading, setLineDetailLoading] = useState(false);

  const fetchArrivals = async () => {
    setArrivalsLoading(true);
    setArrivalsError(false);
    try {
      const res = await fetch(`/api/arrivals?stopCode=${encodeURIComponent(stop.code)}`);
      const data = await res.json();
      setArrivals(data.arrivals ?? []);
    } catch {
      setArrivalsError(true);
    } finally {
      setArrivalsLoading(false);
    }
  };

  const fetchLines = async () => {
    setLinesLoading(true);
    setLinesError(false);
    try {
      const params = new URLSearchParams({ stopCode: stop.code });
      if (stop.id) params.set('stopId', stop.id);
      const res = await fetch(`/api/stop-lines?${params}`);
      const data = await res.json();
      setStopLines(data.lines ?? []);
    } catch {
      setLinesError(true);
    } finally {
      setLinesLoading(false);
      setLinesFetched(true);
    }
  };

  const fetchLineDetail = async (line: StopLine) => {
    setSelectedLine(line);
    setLineDetailLoading(true);
    setLineStops([]);
    try {
      const res = await fetch(`/api/line-route?routeId=${encodeURIComponent(line.routeId)}`);
      const data = await res.json();
      setLineStops(data.stops ?? []);
    } catch {
      setLineStops([]);
    } finally {
      setLineDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchArrivals();
    const interval = setInterval(fetchArrivals, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop.code]);

  // Fetch lines when tab switches to 'lines' (once per stop)
  useEffect(() => {
    if (tab === 'lines' && !linesFetched) {
      fetchLines();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, stop.code]);

  // Reset per-stop state when stop changes
  useEffect(() => {
    setLinesFetched(false);
    setStopLines([]);
    setSelectedLine(null);
    setLineStops([]);
  }, [stop.code]);

  const isMetroStop = stop.type === 'metro' || stop.id?.startsWith('M');

  return (
    <div className="bg-white rounded-t-3xl shadow-2xl border-t border-gray-100 max-h-[70vh] flex flex-col">
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-gray-200" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-1 pb-2">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-base leading-tight truncate">{stop.name}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {stop.code && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-md px-2 py-0.5">
                {t('stop.code')}: {stop.code}
              </span>
            )}
            {stop.type && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-2 py-0.5"
                style={{ background: TYPE_COLOR[stop.type] + '1a', color: TYPE_COLOR[stop.type] }}
              >
                {TYPE_EMOJI[stop.type]} {stop.type.charAt(0).toUpperCase() + stop.type.slice(1)}
              </span>
            )}
            {arrivals.some(a => a.isRealtime) && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 rounded-md px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
          {tab === 'arrivals' && (
            <button
              onClick={fetchArrivals}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-600"
              aria-label="Refresh"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-4">
        <button
          onClick={() => { setTab('arrivals'); setSelectedLine(null); }}
          className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'arrivals'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('stop.arrivals') || 'Arrivals'}
        </button>
        <button
          onClick={() => { setTab('lines'); setSelectedLine(null); }}
          className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'lines'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Lines
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1 px-4 pb-6">

        {/* ── ARRIVALS TAB ── */}
        {tab === 'arrivals' && (
          <>
            {isMetroStop && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-purple-50 rounded-xl border border-purple-100">
                <span className="text-lg flex-shrink-0">🚇</span>
                <p className="text-xs text-purple-700">Metro real-time tracking is not available. Check the Lines tab for scheduled services.</p>
              </div>
            )}
            {arrivalsLoading ? (
              <div className="flex items-center justify-center py-10 gap-2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-400">{t('stop.loadingArrivals')}</span>
              </div>
            ) : arrivalsError ? (
              <div className="text-center py-8">
                <p className="text-red-500 text-sm">{t('errors.apiError')}</p>
                <button onClick={fetchArrivals} className="mt-3 text-sm text-blue-600 font-medium hover:underline">
                  {t('errors.retry')}
                </button>
              </div>
            ) : arrivals.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">{t('stop.noArrivals')}</p>
                <button onClick={() => setTab('lines')} className="mt-2 text-xs text-blue-500 hover:underline">
                  View lines at this stop →
                </button>
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                {arrivals.map((a, i) => {
                  const urgent = a.minutes <= 1;
                  const soon = a.minutes <= 4;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                        urgent ? 'bg-red-50 border-red-100' : soon ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-transparent'
                      }`}
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 shadow-sm"
                        style={{ background: TYPE_COLOR[a.type] }}
                      >
                        <span className="text-base leading-none">{TYPE_EMOJI[a.type]}</span>
                        <span className="text-white text-[10px] font-bold leading-tight mt-0.5">{a.line}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{a.direction || '—'}</p>
                        {a.isRealtime && (
                          <p className="text-[11px] text-green-600 flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                            Real-time
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {a.minutes === 0 ? (
                          <p className="text-sm font-bold text-red-600">Now</p>
                        ) : (
                          <>
                            <p className={`text-2xl font-bold leading-none ${urgent ? 'text-red-600' : soon ? 'text-orange-500' : 'text-gray-800'}`}>
                              {a.minutes}
                            </p>
                            <p className="text-[10px] text-gray-400 font-medium">{t('stop.minutes')}</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── LINES TAB ── */}
        {tab === 'lines' && (
          <>
            {/* Line detail view */}
            {selectedLine ? (
              <div className="mt-3">
                <button
                  onClick={() => setSelectedLine(null)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline mb-3"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to lines
                </button>

                {/* Line header */}
                <div
                  className="flex items-center gap-3 p-3 rounded-2xl mb-3"
                  style={{ background: TYPE_COLOR[selectedLine.type] + '15' }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ background: TYPE_COLOR[selectedLine.type] }}
                  >
                    <span className="text-lg leading-none">{TYPE_EMOJI[selectedLine.type]}</span>
                    <span className="text-white text-[11px] font-bold leading-tight mt-0.5">{selectedLine.name}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-sm capitalize">{selectedLine.type} {selectedLine.name}</p>
                    {selectedLine.directions.length > 0 && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">→ {selectedLine.directions.join(' / ')}</p>
                    )}
                  </div>
                </div>

                {/* Route stops */}
                {lineDetailLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-400">Loading route…</span>
                  </div>
                ) : lineStops.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Route stops not available right now.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[19px] top-4 bottom-4 w-0.5" style={{ background: TYPE_COLOR[selectedLine.type] + '40' }} />
                    <div className="space-y-0">
                      {lineStops.map((s, idx) => {
                        const isCurrent = s.code === stop.code || s.id === stop.id;
                        const isFirst = idx === 0;
                        const isLast = idx === lineStops.length - 1;
                        return (
                          <div key={s.id + idx} className="flex items-center gap-3 py-1.5 relative">
                            <div
                              className={`w-[10px] h-[10px] rounded-full flex-shrink-0 border-2 z-10 ${
                                isCurrent ? 'w-[14px] h-[14px] border-[3px]' : ''
                              } ${isFirst || isLast ? 'w-[12px] h-[12px]' : ''}`}
                              style={{
                                background: isCurrent ? TYPE_COLOR[selectedLine.type] : 'white',
                                borderColor: TYPE_COLOR[selectedLine.type],
                                marginLeft: isCurrent ? 'calc(9.5px)' : isFirst || isLast ? '10px' : '11px',
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate ${isCurrent ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                                {s.name}
                                {isCurrent && (
                                  <span className="ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ background: TYPE_COLOR[selectedLine.type] }}>
                                    Here
                                  </span>
                                )}
                              </p>
                              {s.code && <p className="text-[11px] text-gray-400">{s.code}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Lines list
              <>
                {linesLoading ? (
                  <div className="flex items-center justify-center py-10 gap-2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-400">Loading lines…</span>
                  </div>
                ) : linesError ? (
                  <div className="text-center py-8">
                    <p className="text-red-500 text-sm">{t('errors.apiError')}</p>
                    <button onClick={fetchLines} className="mt-3 text-sm text-blue-600 font-medium hover:underline">{t('errors.retry')}</button>
                  </div>
                ) : stopLines.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">
                      {isMetroStop
                        ? 'Metro schedule data is not available in the real-time feed.'
                        : 'No line data available for this stop right now.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 mt-3">
                    {stopLines.map((line) => (
                      <button
                        key={line.routeId}
                        onClick={() => fetchLineDetail(line)}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-transparent hover:border-gray-200 hover:bg-white active:bg-gray-100 transition-all text-left"
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 shadow-sm"
                          style={{ background: TYPE_COLOR[line.type] }}
                        >
                          <span className="text-sm leading-none">{TYPE_EMOJI[line.type]}</span>
                          <span className="text-white text-[10px] font-bold leading-tight mt-0.5">{line.name}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 capitalize">{line.type} {line.name}</p>
                          {line.directions.length > 0 && (
                            <p className="text-xs text-gray-500 truncate">{line.directions.slice(0, 2).join(' / ')}</p>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
