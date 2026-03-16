'use client';

import { useEffect, useState } from 'react';
import type { Stop, ArrivalTime, VehicleType } from '@/lib/types';
import { useT } from './TranslationContext';

const TYPE_BG: Record<VehicleType, string> = {
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

interface StopArrivalsProps {
  stop: Stop;
  onClose: () => void;
}

export default function StopArrivals({ stop, onClose }: StopArrivalsProps) {
  const { t } = useT();
  const [arrivals, setArrivals] = useState<ArrivalTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchArrivals = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/arrivals?stopCode=${encodeURIComponent(stop.code)}`);
      const data = await res.json();
      setArrivals(data.arrivals ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArrivals();
    const interval = setInterval(fetchArrivals, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop.code]);

  return (
    <div className="bg-white rounded-t-3xl shadow-2xl border-t border-gray-100 max-h-[65vh] flex flex-col">
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-gray-200" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-1 pb-2">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-base leading-tight truncate">{stop.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            {stop.code && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-md px-2 py-0.5">
                {t('stop.code')}: {stop.code}
              </span>
            )}
            {arrivals.some(a => a.isRealtime) && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 rounded-md px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                Live data
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          <button
            onClick={fetchArrivals}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-600"
            aria-label="Refresh"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
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

      {/* Arrivals list */}
      <div className="overflow-y-auto flex-1 px-4 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400">{t('stop.loadingArrivals')}</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-500 text-sm">{t('errors.apiError')}</p>
            <button onClick={fetchArrivals} className="mt-3 text-sm text-blue-600 font-medium hover:underline">
              {t('errors.retry')}
            </button>
          </div>
        ) : arrivals.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">{t('stop.noArrivals')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {arrivals.map((a, i) => {
              const urgent = a.minutes <= 1;
              const soon = a.minutes <= 4;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                    urgent
                      ? 'bg-red-50 border-red-100'
                      : soon
                      ? 'bg-orange-50 border-orange-100'
                      : 'bg-gray-50 border-transparent'
                  }`}
                >
                  {/* Line badge */}
                  <div
                    className="w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ background: TYPE_BG[a.type] }}
                  >
                    <span className="text-base leading-none">{TYPE_EMOJI[a.type]}</span>
                    <span className="text-white text-[10px] font-bold leading-tight mt-0.5">{a.line}</span>
                  </div>

                  {/* Direction */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.direction || '—'}</p>
                    {a.isRealtime && (
                      <p className="text-[11px] text-green-600 flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                        Real-time
                      </p>
                    )}
                  </div>

                  {/* Countdown */}
                  <div className="text-right flex-shrink-0">
                    {a.minutes === 0 ? (
                      <p className="text-sm font-bold text-red-600">Now</p>
                    ) : (
                      <>
                        <p className={`text-2xl font-bold leading-none ${
                          urgent ? 'text-red-600' : soon ? 'text-orange-500' : 'text-gray-800'
                        }`}>
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
      </div>
    </div>
  );
}
