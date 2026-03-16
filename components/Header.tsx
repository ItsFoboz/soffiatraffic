'use client';

import { useT } from './TranslationContext';
import { useAuth } from './AuthContext';
import { signOut, signInWithGoogle } from '@/lib/auth';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import type { Locale } from '@/lib/i18n';

export default function Header() {
  const { t, locale, changeLocale } = useT();
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 safe-area-pt"
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        height: '52px',
      }}
    >
      <div className="flex items-center justify-between px-4 h-full">
        {/* Logo + title */}
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Sofia Traffic" className="w-7 h-7 rounded-md flex-shrink-0" />
          <div>
            <h1 className="leading-tight font-bold" style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-base)' }}>
              {t('app.title')}
            </h1>
            <p className="leading-tight" style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
              {t('app.subtitle')}
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Language toggle — text-only, compact outline button */}
          <button
            onClick={() => changeLocale(locale === 'bg' ? 'en' : ('bg' as Locale))}
            className="flex items-center gap-1 rounded-full px-2.5 py-1"
            style={{
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            <span className="text-sm">{locale === 'bg' ? '🇧🇬' : '🇬🇧'}</span>
            <span>{locale === 'bg' ? 'BG' : 'EN'}</span>
          </button>

          {/* Auth */}
          {loading ? (
            <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: 'var(--color-bg)' }} />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen((v) => !v)} className="focus:outline-none" aria-label={t('auth.myAccount')}>
                {user.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName ?? 'User'}
                    width={32}
                    height={32}
                    className="rounded-full"
                    style={{ border: '2px solid var(--color-border)' }}
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    {user.displayName?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-11 w-64 rounded-2xl overflow-hidden z-50"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
                >
                  <div className="px-4 py-3" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <div className="flex items-center gap-3">
                      {user.photoURL ? (
                        <Image src={user.photoURL} alt={user.displayName ?? 'User'} width={40} height={40} className="rounded-full flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: 'var(--color-primary)' }}>
                          {user.displayName?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{user.displayName}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{user.email}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); signOut(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-red-50"
                    style={{ color: 'var(--color-error)' }}
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
            /* Ghost sign-in: 32px height, outline style */
            <button
              onClick={() => signInWithGoogle()}
              className="flex items-center gap-1.5 rounded-full px-3"
              style={{
                height: '32px',
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-primary)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
              }}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="hidden sm:inline">{t('auth.signInWithGoogle')}</span>
              <span className="sm:hidden">Sign in</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
