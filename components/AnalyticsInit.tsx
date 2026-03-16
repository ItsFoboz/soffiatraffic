'use client';

import { useEffect } from 'react';
import { getAnalytics } from '@/lib/analytics';

// Mount this once in the layout to warm up Firebase Analytics
export default function AnalyticsInit() {
  useEffect(() => {
    getAnalytics().catch(() => {});
  }, []);
  return null;
}
