'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle } from '@/lib/auth';
import { useAuth } from '@/components/AuthContext';
import { useT } from '@/components/TranslationContext';
import type { Locale } from '@/lib/i18n';

export default function LoginClient() {
  const { t, locale, changeLocale } = useT();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [user, loading, router]);

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed';
      // Ignore popup-closed-by-user error
      if (!msg.includes('popup-closed-by-user') && !msg.includes('cancelled')) {
        setError(msg);
      }
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-blue-700 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-blue-700 via-blue-600 to-blue-800 flex flex-col">
      {/* Language toggle */}
      <div className="flex justify-end p-4 safe-area-pt">
        <button
          onClick={() => changeLocale(locale === 'bg' ? 'en' : ('bg' as Locale))}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full text-sm font-semibold text-white transition-colors"
        >
          <span>{locale === 'bg' ? '🇧🇬' : '🇬🇧'}</span>
          <span>{locale === 'bg' ? 'BG' : 'EN'}</span>
        </button>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center mb-6 backdrop-blur-sm border border-white/20">
          <span className="text-5xl">🚌</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">{t('app.title')}</h1>
        <p className="text-blue-100 text-base mb-10 max-w-xs">{t('app.subtitle')}</p>

        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {['🗺️ Live map', '🚏 Stop times', '🔀 Route planner', '⭐ Synced favorites'].map((f) => (
            <span key={f} className="bg-white/15 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
              {f}
            </span>
          ))}
        </div>

        {error && (
          <div className="mb-4 px-4 py-2.5 bg-red-500/20 border border-red-300/30 rounded-xl text-red-100 text-sm max-w-xs">
            {error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="w-full max-w-xs flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold py-4 px-6 rounded-2xl shadow-xl hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {signingIn ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          <span>{signingIn ? t('search.searching') : t('auth.signInWithGoogle')}</span>
        </button>

        <p className="mt-4 text-blue-200 text-xs max-w-xs">{t('auth.privacyNote')}</p>
      </div>

      <div className="pb-8 safe-area-pb text-center">
        <p className="text-blue-300 text-xs">
          Data from <span className="text-blue-100 font-medium">sofiatraffic.bg</span>
          {' '}· Map by <span className="text-blue-100 font-medium">OpenStreetMap</span>
        </p>
      </div>
    </div>
  );
}
