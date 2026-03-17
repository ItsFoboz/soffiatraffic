'use client';

import { useEffect, useState } from 'react';
import type { Stop, ArrivalTime, VehicleType } from '@/lib/types';
import type { StopLine } from '@/app/api/stop-lines/route';
import { useT } from './TranslationContext';

const TYPE_COLOR: Record<VehicleType, string> = {
  bus:     'var(--color-bus)',
  tram:    'var(--color-tram)',
  trolley: 'var(--color-trolley)',
  metro:   'var(--color-metro)',
};

const TYPE_EMOJI: Record<VehicleType, string> = {
  bus: '🚌', tram: '🚊', trolley: '🚎', metro: '🚇',
};

interface LineRouteStop { id: string; code: string; name: string; lat: number; lng: number; }
interface StopArrivalsProps { stop: Stop; onClose: () => void; }

export default function StopArrivals({ stop, onClose }: StopArrivalsProps) {
  const { t } = useT();
  const [tab, setTab] = useState<'arrivals' | 'lines'>('arrivals');

  const [arrivals, setArrivals] = useState<ArrivalTime[]>([]);
  const [arrivalsLoading, setArrivalsLoading] = useState(true);
  const [arrivalsError, setArrivalsError] = useState(false);

  const [stopLines, setStopLines] = useState<StopLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [linesError, setLinesError] = useState(false);
  const [linesFetched, setLinesFetched] = useState(false);

  const [selectedLine, setSelectedLine] = useState<StopLine | null>(null);
  const [lineStops, setLineStops] = useState<LineRouteStop[]>([]);
  const [lineDetailLoading, setLineDetailLoading] = useState(false);

  const fetchArrivals = async () => {
    setArrivalsLoading(true); setArrivalsError(false);
    try {
      const res = await fetch(`/api/arrivals?stopCode=${encodeURIComponent(stop.code)}`);
      const data = await res.json();
      setArrivals(data.arrivals ?? []);
    } catch { setArrivalsError(true); }
    finally { setArrivalsLoading(false); }
  };

  const fetchLines = async () => {
    setLinesLoading(true); setLinesError(false);
    try {
      const params = new URLSearchParams({ stopCode: stop.code });
      if (stop.id) params.set('stopId', stop.id);
      const res = await fetch(`/api/stop-lines?${params}`);
      const data = await res.json();
      setStopLines(data.lines ?? []);
    } catch { setLinesError(true); }
    finally { setLinesLoading(false); setLinesFetched(true); }
  };

  const fetchLineDetail = async (line: StopLine) => {
    setSelectedLine(line); setLineDetailLoading(true); setLineStops([]);
    try {
      const res = await fetch(`/api/line-route?routeId=${encodeURIComponent(line.routeId)}`);
      const data = await res.json();
      setLineStops(data.stops ?? []);
    } catch { setLineStops([]); }
    finally { setLineDetailLoading(false); }
  };

  useEffect(() => {
    fetchArrivals();
    const id = setInterval(fetchArrivals, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop.code]);

  useEffect(() => {
    if (tab === 'lines' && !linesFetched) fetchLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, stop.code]);

  useEffect(() => {
    setLinesFetched(false); setStopLines([]); setSelectedLine(null); setLineStops([]);
  }, [stop.code]);

  const hasLive = arrivals.some((a) => a.isRealtime);
  const isMetroStop = stop.type === 'metro' || stop.id?.startsWith('M');

  return (
    <div
      className="max-h-[70vh] flex flex-col"
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-2 pb-0">
        <div className="w-9 h-1 rounded-full" style={{ background: 'var(--color-border)', marginTop: '8px' }} />
      </div>

      {/* Header — stop name + badges + close */}
      <div className="flex items-start justify-between px-5 pt-3 pb-3">
        <div className="flex-1 min-w-0 pr-2">
          <h2
            className="font-bold leading-snug truncate"
            style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-primary)' }}
          >
            {stop.name}
          </h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {stop.code && (
              <span
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5"
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-muted)',
                  background: 'var(--color-bg)',
                  fontWeight: 'var(--font-weight-medium)',
                }}
              >
                {t('stop.code')}: {stop.code}
              </span>
            )}
            {stop.type && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-white"
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-semibold)',
                  background: TYPE_COLOR[stop.type],
                }}
              >
                {TYPE_EMOJI[stop.type]} {stop.type.charAt(0).toUpperCase() + stop.type.slice(1)}
              </span>
            )}
            {hasLive && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-live)', background: '#f0fdf4', fontWeight: 'var(--font-weight-semibold)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block animate-live" style={{ background: 'var(--color-live)' }} />
                {t('stop.live')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {tab === 'arrivals' && (
            <button
              onClick={fetchArrivals}
              className="p-1.5 rounded-full hover:bg-gray-100"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label="Refresh"
            >
              <svg className={`w-4 h-4 ${arrivalsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs — underline style */}
      <div className="flex px-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        {(['arrivals', 'lines'] as const).map((id) => (
          <button
            key={id}
            onClick={() => { setTab(id); setSelectedLine(null); }}
            className="flex-1 py-2.5"
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              color: tab === id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderBottom: tab === id ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {id === 'arrivals' ? (t('stop.arrivals') || 'Arrivals') : 'Линии'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1 pb-6">

        {/* ── ARRIVALS TAB ── */}
        {tab === 'arrivals' && (
          <>
            {isMetroStop && (
              <div className="mx-5 mt-3 flex items-start gap-2 p-3 rounded-xl" style={{ background: '#f5f3ff', border: '1px solid #e0d9ff' }}>
                <span className="text-lg flex-shrink-0">🚇</span>
                <p style={{ fontSize: 'var(--font-size-xs)', color: '#5b21b6' }}>Metro real-time tracking is not available. Check the Lines tab for scheduled services.</p>
              </div>
            )}

            {arrivalsLoading ? (
              <div className="flex items-center justify-center py-10 gap-2">
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{t('stop.loadingArrivals')}</span>
              </div>
            ) : arrivalsError ? (
              <div className="text-center py-8">
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error)' }}>{t('errors.apiError')}</p>
                <button onClick={fetchArrivals} className="mt-3" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)' }}>
                  {t('errors.retry')}
                </button>
              </div>
            ) : arrivals.length === 0 ? (
              <div className="text-center py-8">
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{t('stop.noArrivals')}</p>
                <button onClick={() => setTab('lines')} className="mt-2" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>
                  View lines at this stop →
                </button>
              </div>
            ) : (
              <div>
                {arrivals.map((a, i) => {
                  const urgent = a.minutes <= 1;
                  const soon   = a.minutes <= 4;
                  const minutesValid = typeof a.minutes === 'number' && !isNaN(a.minutes);

                  return (
                    <div
                      key={i}
                      className="flex items-center gap-4"
                      style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--color-border)',
                        background: 'transparent',
                        borderLeft: urgent ? '3px solid var(--color-error)' : soon ? '3px solid var(--color-warning)' : '3px solid transparent',
                      }}
                    >
                      {/* Line badge: square with rounded corners */}
                      <div
                        className="flex flex-col items-center justify-center flex-shrink-0"
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: 'var(--radius-sm)',
                          background: TYPE_COLOR[a.type],
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        <span className="leading-none" style={{ fontSize: '22px' }}>{TYPE_EMOJI[a.type]}</span>
                        <span className="text-white leading-tight mt-0.5" style={{ fontSize: '10px', fontWeight: 'var(--font-weight-bold)' }}>{a.line}</span>
                      </div>

                      {/* Direction + realtime */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="truncate"
                          style={{
                            fontSize: 'var(--font-size-base)',
                            fontWeight: 600,
                            color: '#111827',
                          }}
                        >
                          {a.direction || `${a.type.charAt(0).toUpperCase() + a.type.slice(1)} ${a.line}`}
                        </p>
                        {a.isRealtime && (
                          <p className="flex items-center gap-1 mt-0.5" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-live)' }}>
                            <span className="w-1.5 h-1.5 rounded-full inline-block animate-live" style={{ background: 'var(--color-live)' }} />
                            {t('stop.realtime')}
                          </p>
                        )}
                      </div>

                      {/* Arrival time */}
                      <div className="text-right flex-shrink-0">
                        {!minutesValid ? (
                          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>No data</p>
                        ) : a.minutes === 0 ? (
                          <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>Now</p>
                        ) : (
                          <>
                            <p
                              key={a.minutes}
                              className="animate-number-fade"
                              style={{
                                fontSize: '22px',
                                fontWeight: 'var(--font-weight-bold)',
                                lineHeight: 1,
                                color: urgent ? 'var(--color-error)' : soon ? 'var(--color-warning)' : 'var(--color-primary)',
                              }}
                            >
                              {a.minutes}
                            </p>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 'var(--font-weight-medium)' }}>{t('stop.minutes')}</p>
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
            {selectedLine ? (
              <div className="px-5 mt-3">
                <button
                  onClick={() => setSelectedLine(null)}
                  className="flex items-center gap-1.5 mb-3"
                  style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to lines
                </button>

                <div
                  className="flex items-center gap-3 p-3 rounded-xl mb-4"
                  style={{ background: TYPE_COLOR[selectedLine.type] + '18' }}
                >
                  <div
                    className="w-12 h-12 flex flex-col items-center justify-center flex-shrink-0"
                    style={{ borderRadius: 'var(--radius-md)', background: TYPE_COLOR[selectedLine.type], boxShadow: 'var(--shadow-sm)' }}
                  >
                    <span className="text-lg leading-none">{TYPE_EMOJI[selectedLine.type]}</span>
                    <span className="text-white leading-tight mt-0.5" style={{ fontSize: '11px', fontWeight: 'var(--font-weight-bold)' }}>{selectedLine.name}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold capitalize" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                      {selectedLine.type} {selectedLine.name}
                    </p>
                    {selectedLine.directions.length > 0 && (
                      <p className="truncate mt-0.5" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        → {selectedLine.directions.join(' / ')}
                      </p>
                    )}
                  </div>
                </div>

                {lineDetailLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Loading route…</span>
                  </div>
                ) : lineStops.length === 0 ? (
                  <p className="text-center py-6" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Route stops not available right now.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[19px] top-4 bottom-4 w-0.5" style={{ background: TYPE_COLOR[selectedLine.type] + '40' }} />
                    {lineStops.map((s, idx) => {
                      const isCurrent = s.code === stop.code || s.id === stop.id;
                      const isFirst   = idx === 0;
                      const isLast    = idx === lineStops.length - 1;
                      return (
                        <div key={s.id + idx} className="flex items-center gap-3 py-1.5 relative">
                          <div
                            className="z-10 flex-shrink-0 rounded-full border-2"
                            style={{
                              width:  isCurrent ? '14px' : isFirst || isLast ? '12px' : '10px',
                              height: isCurrent ? '14px' : isFirst || isLast ? '12px' : '10px',
                              marginLeft: isCurrent ? '9.5px' : isFirst || isLast ? '10px' : '11px',
                              background: isCurrent ? TYPE_COLOR[selectedLine.type] : 'white',
                              borderColor: TYPE_COLOR[selectedLine.type],
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className="truncate"
                              style={{
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: isCurrent ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
                                color: 'var(--color-text-primary)',
                              }}
                            >
                              {s.name}
                              {isCurrent && (
                                <span className="ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ background: TYPE_COLOR[selectedLine.type] }}>
                                  Here
                                </span>
                              )}
                            </p>
                            {s.code && <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{s.code}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-5">
                {linesLoading ? (
                  <div className="flex items-center justify-center py-10 gap-2">
                    <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Loading lines…</span>
                  </div>
                ) : linesError ? (
                  <div className="text-center py-8">
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error)' }}>{t('errors.apiError')}</p>
                    <button onClick={fetchLines} className="mt-3" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)' }}>{t('errors.retry')}</button>
                  </div>
                ) : stopLines.length === 0 ? (
                  <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                    <p style={{ fontSize: 'var(--font-size-sm)' }}>
                      {isMetroStop ? 'Metro schedule data is not available in the real-time feed.' : 'No line data available for this stop right now.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 mt-3">
                    {stopLines.map((line) => (
                      <button
                        key={line.routeId}
                        onClick={() => fetchLineDetail(line)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl text-left"
                        style={{ background: 'var(--color-bg)', border: '1px solid transparent' }}
                      >
                        <div
                          className="w-10 h-10 flex flex-col items-center justify-center flex-shrink-0"
                          style={{ borderRadius: 'var(--radius-md)', background: TYPE_COLOR[line.type], boxShadow: 'var(--shadow-sm)' }}
                        >
                          <span className="text-sm leading-none">{TYPE_EMOJI[line.type]}</span>
                          <span className="text-white leading-tight mt-0.5" style={{ fontSize: '10px', fontWeight: 'var(--font-weight-bold)' }}>{line.name}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="capitalize" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>{line.type} {line.name}</p>
                          {line.directions.length > 0 && (
                            <p className="truncate" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{line.directions.slice(0, 2).join(' / ')}</p>
                          )}
                        </div>
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-text-muted)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
