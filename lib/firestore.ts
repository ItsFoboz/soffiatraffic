import {
  doc,
  collection,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Stop } from './types';

// Path: users/{userId}/favorites/{stopId}
function favoritesRef(userId: string) {
  return collection(db, 'users', userId, 'favorites');
}

function favoriteDoc(userId: string, stopId: string) {
  return doc(db, 'users', userId, 'favorites', stopId);
}

export async function addFavoriteToFirestore(userId: string, stop: Stop): Promise<void> {
  await setDoc(favoriteDoc(userId, stop.id), {
    ...stop,
    savedAt: serverTimestamp(),
  });
}

export async function removeFavoriteFromFirestore(userId: string, stopId: string): Promise<void> {
  await deleteDoc(favoriteDoc(userId, stopId));
}

export async function getFavoritesFromFirestore(userId: string): Promise<Stop[]> {
  const { getDocs } = await import('firebase/firestore');
  const snap = await getDocs(favoritesRef(userId));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      nameBg: data.nameBg,
      lat: data.lat,
      lng: data.lng,
      lines: data.lines,
    } as Stop;
  });
}

export function subscribeFavorites(
  userId: string,
  onChange: (stops: Stop[]) => void
): Unsubscribe {
  return onSnapshot(favoritesRef(userId), (snap) => {
    const stops: Stop[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id,
        code: data.code,
        name: data.name,
        nameBg: data.nameBg,
        lat: data.lat,
        lng: data.lng,
        lines: data.lines,
      } as Stop;
    });
    onChange(stops);
  });
}

// ── Per-user saved routes ────────────────────────────────────

export interface SavedRoute {
  id: string;
  fromName: string;
  toName: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  savedAt?: unknown;
}

function routesRef(userId: string) {
  return collection(db, 'users', userId, 'savedRoutes');
}

function routeDoc(userId: string, routeId: string) {
  return doc(db, 'users', userId, 'savedRoutes', routeId);
}

export async function saveRouteToFirestore(userId: string, route: Omit<SavedRoute, 'savedAt'>): Promise<void> {
  await setDoc(routeDoc(userId, route.id), {
    ...route,
    savedAt: serverTimestamp(),
  });
}

export async function deleteRouteFromFirestore(userId: string, routeId: string): Promise<void> {
  await deleteDoc(routeDoc(userId, routeId));
}

export function subscribeSavedRoutes(
  userId: string,
  onChange: (routes: SavedRoute[]) => void
): Unsubscribe {
  return onSnapshot(routesRef(userId), (snap) => {
    const routes: SavedRoute[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedRoute));
    onChange(routes);
  });
}

// ── User profile doc ─────────────────────────────────────────

export async function upsertUserProfile(userId: string, data: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}): Promise<void> {
  const ref = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...data, createdAt: serverTimestamp() });
  }
}
