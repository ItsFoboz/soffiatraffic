'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Stop } from '@/lib/types';
import { useT } from './TranslationContext';
import { useAuth } from './AuthContext';
import StopArrivals from './StopArrivals';
import {
  subscribeFavorites,
  addFavoriteToFirestore,
  removeFavoriteFromFirestore,
} from '@/lib/firestore';

const LOCAL_KEY = 'sofia-transit-favorites';

function localLoad(): Stop[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]'); } catch { return []; }
}
function localSave(stops: Stop[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(stops));
}

// ── useFavorites ─────────────────────────────────────────────
// When signed in  → Firestore (real-time, cross-device)
// When signed out → localStorage (local only)

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Stop[]>([]);

  useEffect(() => {
    if (user) {
      // Subscribe to Firestore favorites in real-time
      const unsub = subscribeFavorites(user.uid, setFavorites);
      return unsub;
    } else {
      // Fall back to localStorage
      setFavorites(localLoad());
    }
  }, [user]);

  const addFavorite = useCallback(async (stop: Stop) => {
    if (user) {
      await addFavoriteToFirestore(user.uid, stop);
      // Firestore subscription will update state automatically
    } else {
      const updated = [...favorites.filter((f) => f.id !== stop.id), stop];
      setFavorites(updated);
      localSave(updated);
    }
  }, [user, favorites]);

  const removeFavorite = useCallback(async (stopId: string) => {
    if (user) {
      await removeFavoriteFromFirestore(user.uid, stopId);
    } else {
      const updated = favorites.filter((f) => f.id !== stopId);
      setFavorites(updated);
      localSave(updated);
    }
  }, [user, favorites]);

  const isFavorite = useCallback(
    (stopId: string) => favorites.some((f) => f.id === stopId),
    [favorites]
  );

  return { favorites, addFavorite, removeFavorite, isFavorite };
}

// ── FavoritesTab component ───────────────────────────────────

interface FavoritesTabProps {
  onStopSelect?: (stop: Stop) => void;
}

export default function FavoritesTab({ onStopSelect }: FavoritesTabProps) {
  const { t } = useT();
  const { user } = useAuth();
  const { favorites, removeFavorite } = useFavorites();
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span>⭐</span>
          <span>{t('nav.favorites')}</span>
        </h2>
        {user && favorites.length > 0 && (
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {favorites.length} запазени спирки
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <p className="text-gray-500 text-sm">No favorite stops yet</p>
            <p className="text-gray-400 text-xs mt-1">Find stops in the Stops tab and add them here</p>
            {!user && (
              <p className="mt-3 text-xs text-blue-600">Sign in to sync across devices</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {favorites.map((stop) => (
              <div key={stop.id}>
                <button
                  onClick={() => onStopSelect ? onStopSelect(stop) : setSelectedStop(selectedStop?.id === stop.id ? null : stop)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-amber-200 hover:bg-amber-50 transition-all shadow-sm text-left"
                >
                  <span className="text-xl">🚏</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{stop.name}</p>
                    {stop.code && <p className="text-xs text-gray-500">{t('stop.code')}: {stop.code}</p>}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFavorite(stop.id); }}
                    className="p-1.5 text-amber-500 hover:text-red-500 transition-colors flex-shrink-0"
                    aria-label="Remove favorite"
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
