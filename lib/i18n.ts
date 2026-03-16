export const locales = ['en', 'bg'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'bg';

export function getLocaleFromCookie(): Locale {
  if (typeof document === 'undefined') return defaultLocale;
  const match = document.cookie.match(/locale=([^;]+)/);
  const val = match?.[1] as Locale;
  return locales.includes(val) ? val : defaultLocale;
}

export function setLocaleCookie(locale: Locale) {
  document.cookie = `locale=${locale}; path=/; max-age=31536000`;
}
