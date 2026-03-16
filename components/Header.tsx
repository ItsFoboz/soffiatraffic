'use client';

import { useT } from './TranslationContext';
import { useSession, signOut, signIn } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import type { Locale } from '@/lib/i18n';

export default function Header() {
  const { t, locale, changeLocale } = useT();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-blue-700 text-white safe-area-pt">
      <div className="flex items-center justify-between px-4 py-3">
        {/* App title */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚌</span>
          <div>
            <h1 className="text-base font-bold leading-tight">{t('app.title')}</h1>
            <p className="text-[10px] text-blue-200 leading-tight">{t('app.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={() => changeLocale(locale === 'bg' ? 'en' : ('bg' as Locale))}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 px-2.5 py-1.5 rounded-full text-sm font-semibold transition-colors"
          >
            <span className="text-base">{locale === 'bg' ? '🇧🇬' : '🇬🇧'}</span>
            <span>{locale === 'bg' ? 'BG' : 'EN'}</span>
          </button>

          {/* Auth button */}
          {status === 'loading' ? (
            <div className="w-8 h-8 rounded-full bg-blue-500 animate-pulse" />
          ) : session?.user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 focus:outline-none"
                aria-label={t('auth.myAccount')}
              >
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name ?? 'User'}
                    width={32}
                    height={32}
                    className="rounded-full border-2 border-white/50"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white/50 flex items-center justify-center text-sm font-bold">
                    {session.user.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
              </button>

              {/* Dropdown menu */}
              {menuOpen && (
                <div className="absolute right-0 top-10 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  {/* User info */}
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {session.user.image ? (
                        <Image
                          src={session.user.image}
                          alt={session.user.name ?? 'User'}
                          width={40}
                          height={40}
                          className="rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                          {session.user.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {session.user.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {session.user.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sign out */}
                  <button
                    onClick={() => { setMenuOpen(false); signOut({ callbackUrl: '/login' }); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {t('auth.signOut')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => signIn('google', { callbackUrl: '/' })}
              className="flex items-center gap-1.5 bg-white text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="hidden sm:inline">{t('auth.signInWithGoogle')}</span>
              <span className="sm:hidden">Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
