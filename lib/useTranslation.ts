'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Locale } from './i18n';
import { defaultLocale, locales, getLocaleFromCookie, setLocaleCookie } from './i18n';

type Dict = Record<string, unknown>;

function getValue(dict: Dict, key: string): string {
  const keys = key.split('.');
  let val: unknown = dict;
  for (const k of keys) {
    if (typeof val === 'object' && val !== null) {
      val = (val as Dict)[k];
    } else return key;
  }
  return typeof val === 'string' ? val : key;
}

const dicts: Partial<Record<Locale, Dict>> = {};

async function loadDict(locale: Locale): Promise<Dict> {
  if (dicts[locale]) return dicts[locale]!;
  try {
    const res = await fetch(`/messages/${locale}.json`);
    const data = (await res.json()) as Dict;
    dicts[locale] = data;
    return data;
  } catch {
    return {};
  }
}

export function useTranslation() {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [dict, setDict] = useState<Dict>({});

  useEffect(() => {
    const saved = getLocaleFromCookie();
    setLocale(saved);
    loadDict(saved).then(setDict);
  }, []);

  const changeLocale = useCallback((next: Locale) => {
    if (!locales.includes(next)) return;
    setLocaleCookie(next);
    setLocale(next);
    loadDict(next).then(setDict);
  }, []);

  const t = useCallback((key: string) => getValue(dict, key), [dict]);

  return { t, locale, changeLocale };
}
