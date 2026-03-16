'use client';

import type { Analytics } from 'firebase/analytics';

let analytics: Analytics | null = null;

export async function getAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null;
  if (analytics) return analytics;
  try {
    const { getAnalytics: _getAnalytics, isSupported } = await import('firebase/analytics');
    const { app } = await import('./firebase');
    if (await isSupported()) {
      analytics = _getAnalytics(app);
    }
  } catch {
    // Analytics not available (e.g., ad blocker)
  }
  return analytics;
}

export async function logEvent(name: string, params?: Record<string, unknown>) {
  const a = await getAnalytics();
  if (!a) return;
  const { logEvent: _logEvent } = await import('firebase/analytics');
  _logEvent(a, name, params);
}
