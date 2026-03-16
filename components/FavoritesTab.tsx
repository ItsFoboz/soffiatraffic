'use client';

import { useState, useEffect } from 'react';
import type { Stop } from '@/lib/types';
import { useT } from './TranslationContext';
import StopArrivals from './StopArrivals';

const FAVORITES_KEY = 'sofia-transit-favorites';

function loadFavorites(): Stop[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Stop[]>([]);

  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  const addFavorite = (stop: Stop) => {
    const updated = [...favorites.filter((f) => f.id !== stop.id), stop];
    setFavorites(updated);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  };

  const removeFavorite = (stopId: string) => {
    const updated = favorites.filter((f) => f.id !== stopId);
    setFavorites(updated);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  };

  const isFavorite = (stopId: string) => favorites.some((f) => f.id === stopId);

  return { favorites, addFavorite, removeFavorite, isFavorite };
}

export default function FavoritesTab() {
  const { t } = useT();
  const { favorites, removeFavorite } = useFavorites();
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span>⭐</span>
          <span>{t('nav.favorites')}</span>
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {favorites.length === 0 ? 'Add stops to favorites for quick access' : `${favorites.length} saved stop${favorites.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <span className="text-5xl mb-3">⭐</span>
            <p className="text-gray-500 text-sm">No favorite stops yet</p>
            <p className="text-gray-400 text-xs mt-1">Find stops in the Stops tab and add them here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {favorites.map((stop) => (
              <div key={stop.id}>
                <button
                  onClick={() => setSelectedStop(selectedStop?.id === stop.id ? null : stop)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-amber-200 hover:bg-amber-50 transition-all shadow-sm text-left"
                >
                  <span className="text-xl">🚏</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{stop.name}</p>
                    {stop.code && <p className="text-xs text-gray-500">{t('stop.code')}: {stop.code}</p>}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFavorite(stop.id); }}
                    className="p-1.5 text-amber-500 hover:text-red-500 transition-colors"
                  >
                    ⭐
                  </button>
                </button>
                {selectedStop?.id === stop.id && (
                  <div className="mt-2">
                    <StopArrivals stop={stop} onClose={() => setSelectedStop(null)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
