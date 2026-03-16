import type { Locale } from './i18n';

type TranslationDict = Record<string, unknown>;

const translations: Record<Locale, TranslationDict> = {
  bg: {} as TranslationDict,
  en: {} as TranslationDict,
};

function loadTranslations(locale: Locale): TranslationDict {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(`../messages/${locale}.json`) as TranslationDict;
  } catch {
    return {};
  }
}

export function getTranslations(locale: Locale): TranslationDict {
  if (Object.keys(translations[locale]).length === 0) {
    translations[locale] = loadTranslations(locale);
  }
  return translations[locale];
}

export function t(locale: Locale, key: string): string {
  const dict = getTranslations(locale);
  const keys = key.split('.');
  let val: unknown = dict;
  for (const k of keys) {
    if (typeof val === 'object' && val !== null) {
      val = (val as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }
  return typeof val === 'string' ? val : key;
}
