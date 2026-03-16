'use client';

import React, { createContext, useContext } from 'react';
import { useTranslation } from '@/lib/useTranslation';
import type { Locale } from '@/lib/i18n';

interface TranslationContextValue {
  t: (key: string) => string;
  locale: Locale;
  changeLocale: (locale: Locale) => void;
}

const TranslationContext = createContext<TranslationContextValue>({
  t: (k) => k,
  locale: 'bg',
  changeLocale: () => {},
});

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const value = useTranslation();
  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useT() {
  return useContext(TranslationContext);
}
