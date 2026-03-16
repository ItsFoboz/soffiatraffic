'use client';

import { useEffect, useState } from 'react';
import type { Stop, ArrivalTime, VehicleType } from '@/lib/types';
import { useT } from './TranslationContext';

const TYPE_COLORS: Record<VehicleType, string> = {
  bus: 'bg-blue-100 text-blue-800',
  tram: 'bg-red-100 text-red-800',
  trolley: 'bg-green-100 text-green-800',
  metro: 'bg-purple-100 text-purple-800',
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
    const interval = setInterval(fetchArrivals, 30000); // refresh every 30s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop.code]);

  return (
    <div className="bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 max-h-[60vh] flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-base truncate">{stop.name}</h2>
          {stop.code && (
            <p className="text-xs text-gray-500 mt-0.5">
              {t('stop.code')}: {stop.code}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-3 p-1.5 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
          aria-label="Close"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 pb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{t('stop.arrivals')}</h3>
        <button
          onClick={fetchArrivals}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('errors.retry')}
        </button>
      </div>

      {/* Arrivals list */}
      <div className="overflow-y-auto flex-1 px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-2 text-sm text-gray-500">{t('stop.loadingArrivals')}</span>
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <p className="text-red-500 text-sm">{t('errors.apiError')}</p>
            <button
              onClick={fetchArrivals}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              {t('errors.retry')}
            </button>
          </div>
        ) : arrivals.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-6">{t('stop.noArrivals')}</p>
        ) : (
          <div className="space-y-2">
            {arrivals.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-xl">{TYPE_EMOJI[a.type]}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${TYPE_COLORS[a.type]}`}>
                  {a.line}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{a.direction || '—'}</p>
                  {a.isRealtime && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                      Live
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-lg font-bold ${a.minutes <= 2 ? 'text-red-600' : a.minutes <= 5 ? 'text-orange-500' : 'text-gray-800'}`}>
                    {a.minutes}
                  </p>
                  <p className="text-xs text-gray-500">{t('stop.minutes')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
