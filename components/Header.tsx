'use client';

import { useT } from './TranslationContext';
import type { Locale } from '@/lib/i18n';

export default function Header() {
  const { t, locale, changeLocale } = useT();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-blue-700 text-white safe-area-pt">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚌</span>
          <div>
            <h1 className="text-base font-bold leading-tight">{t('app.title')}</h1>
            <p className="text-[10px] text-blue-200 leading-tight">{t('app.subtitle')}</p>
          </div>
        </div>

        {/* Language toggle */}
        <button
          onClick={() => changeLocale(locale === 'bg' ? 'en' : ('bg' as Locale))}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
        >
          <span className="text-base">{locale === 'bg' ? '🇧🇬' : '🇬🇧'}</span>
          <span>{locale === 'bg' ? 'BG' : 'EN'}</span>
          <svg className="w-3 h-3 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </button>
      </div>
    </header>
  );
}
