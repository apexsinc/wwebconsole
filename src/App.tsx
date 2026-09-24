/**
* @license
* SPDX-License-Identifier: Apache-2.0
*/

import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Wifi,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';

import TabletFrame from './components/TabletFrame.js';
import BottomBar from './components/BottomBar.js';
import ConsoleBoard from './components/ConsoleBoard.js';
import ConfigNavbar from './components/ConfigNavbar.js';
import Toaster from './components/Toaster.js';
// Heavy routes split to keep initial bundle small (was 641KB warning).
const SettingsModal = lazy(() => import('./components/SettingsModal.js'));
const PolarCheckoutModal = lazy(() => import('./components/PolarCheckoutModal.js'));
const TvPage = lazy(() => import('./pages/TvPage.js'));
const AccountPage = lazy(() => import('./pages/AccountPage.js'));
const AdminPage = lazy(() => import('./pages/AdminPage.js'));
const BlogListPage = lazy(() => import('./pages/BlogPages.js').then((m) => ({ default: m.BlogListPage })));
const BlogPostPage = lazy(() => import('./pages/BlogPages.js').then((m) => ({ default: m.BlogPostPage })));

function RouteFallback({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
      <span className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-sky-500 animate-spin" aria-hidden="true" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
import { useWeatherStore } from './store.js';
import { fetchMe, useWeatherQuery, createCheckoutSession, verifyCheckout } from './services/api.js';
import { LoginPage, RegisterPage, VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage } from './pages/AuthPages.js';
import { MarketingLayout, applyDocumentSeo } from './components/MarketingLayout.js';
import {
  AboutPage,
  ChangelogPage,
  ContactPage,
  FeaturesPage,
  HomePage,
  NotFoundPage,
  PricingPage,
  PrivacyPage,
  TermsPage,
} from './pages/MarketingPages.js';
import { applyTheme, getStoredTheme, useTheme } from './hooks/useTheme.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

if (typeof document !== 'undefined') {
  // Default to light mode if user has no stored preference
  const stored = (() => {
    try { return localStorage.getItem('wwc_theme'); } catch { return null; }
  })();
  if (!stored) {
    try { localStorage.setItem('wwc_theme', 'light'); } catch { }
  }
  applyTheme(getStoredTheme());
}

function AdminHostRedirect() {
  useEffect(() => {
    window.location.replace('https://admin.wwebconsole.com/');
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
      Redirecting to admin…
    </div>
  );
}

function useIsPhilippines() {
  const [isPhilippines, setIsPhilippines] = useState(false);

  useEffect(() => {
    try {
      // 1. Check timezone (most reliable – Asia/Manila is PH)
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (tz === 'Asia/Manila' || tz === 'Asia/Philippine') {
        setIsPhilippines(true);
        return;
      }

      // 2. Check all navigator languages (e.g. fil-PH, tl-PH, en-PH, ceb-PH)
      const langs = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
      const isPH = langs.some((l) => {
        const lower = l.toLowerCase();
        return (
          lower.endsWith('-ph') ||          // any language tagged -PH
          lower === 'fil' ||                 // Filipino
          lower === 'tl' ||                  // Tagalog
          lower === 'ceb'                    // Cebuano
        );
      });
      if (isPH) {
        setIsPhilippines(true);
        return;
      }

      // 3. Check locale from Intl.NumberFormat (en-PH, fil-PH, etc.)
      const locale = Intl.NumberFormat().resolvedOptions().locale || '';
      if (locale.toLowerCase().includes('-ph')) {
        setIsPhilippines(true);
      }
    } catch {
      // non-critical – defaults to USD
    }
  }, []);

  return isPhilippines;
}

// USD price and PHP equivalent (approx. ₱60 per $1 as of 2026)
const USD_PRICE = 39;
const PHP_PRICE = Math.round(USD_PRICE * 60); // ₱2,340

function UpgradeProModal({
  isOpen,
  onOpenSettings,
  onStartCheckout,
}: {
  isOpen: boolean;
  onOpenSettings: () => void;
  onStartCheckout: (checkoutUrl: string, checkoutId: string) => void;
}) {
  const isPhilippines = useIsPhilippines();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const trialDays = useWeatherStore((s) => s.trialDays) ?? 30;

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => {
      document.getElementById('wwc-upgrade-title')?.focus();
    }, 60);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setCheckoutError('');
    setIsSubmitting(true);
    try {
      const res = await createCheckoutSession();
      if (res.checkoutUrl) {
        if (window.PolarEmbedCheckout?.create) {
          try {
            await window.PolarEmbedCheckout.create(res.checkoutUrl, 'dark');
            setIsSubmitting(false);
            return;
          } catch {
            // Fallback to internal modal
          }
        }
        onStartCheckout(res.checkoutUrl, res.checkoutId);
        setIsSubmitting(false);
      } else {
        throw new Error('No checkout URL was returned by the server.');
      }
    } catch (err: any) {
      setCheckoutError(err?.message || 'Failed to start Polar checkout. Please try again or contact support.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 select-none cursor-default">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wwc-upgrade-title"
        className="max-w-lg w-full bg-white border border-amber-400/40 rounded-3xl p-6 md:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.25)] flex flex-col items-center text-center"
      >

        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 mb-4 shadow-[0_0_20px_rgba(245,158,11,0.15)]" aria-hidden="true">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <span className="px-3.5 py-1 bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono text-xs font-bold rounded-full uppercase tracking-wider mb-3">
          {trialDays}-Days Free Trial Expired
        </span>

        <h2 id="wwc-upgrade-title" tabIndex={-1} className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight outline-none">
          Upgrade to Console Pro
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-300 mt-2 leading-relaxed font-medium">
          Your {trialDays}-days free trial has ended. Upgrade to Pro for continuous, unlimited access to your live weather console.
        </p>

        <div className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 rounded-2xl p-5 my-6 flex flex-col items-center justify-center gap-1 shadow-inner">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Account Subscription</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-3xl md:text-4xl font-black text-slate-900 font-mono select-none cursor-default pointer-events-none">
              {isPhilippines ? `₱${PHP_PRICE.toLocaleString()}` : `$${USD_PRICE}`}
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-sm font-bold">
              {isPhilippines ? 'PHP' : 'USD'} / year / account
            </span>
          </div>
          {isPhilippines && (
            <span className="text-[11px] text-sky-500 dark:text-sky-400 font-mono font-semibold mt-0.5">
              Approx. ${USD_PRICE} USD / year
            </span>
          )}
          {!isPhilippines && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-semibold mt-0.5">
              Philippine users: approx. ₱{PHP_PRICE.toLocaleString()} PHP / year
            </span>
          )}
        </div>

        <div className="w-full text-left space-y-2.5 mb-6 text-xs text-slate-600 dark:text-slate-300 font-medium bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Unlimited live weather console access for all your devices</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Automatic WeatherLink V2 station &amp; DID discovery</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>TV Share links for lobby and wall monitor displays</span>
          </div>
        </div>

        {checkoutError && (
          <div className="w-full text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3 mb-4 text-left">
            {checkoutError}
          </div>
        )}

        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={handleUpgrade}
            disabled={isSubmitting}
            className="w-full px-5 py-3.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 rounded-xl transition-all cursor-pointer active:scale-95 shadow-[0_4px_20px_rgba(245,158,11,0.35)] flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Redirecting to Polar Checkout…</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Upgrade to Pro with Polar</span>
              </>
            )}
          </button>
          <a
            href="mailto:support@apexs.ph?subject=Console%20Pro%20Account%20Subscription%20Upgrade"
            className="text-xs text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-colors py-1"
          >
            Need invoice, PO, or bank transfer? Contact support
          </a>
        </div>
      </div>
    </div>
  );
}


function MainDashboard() {
  const weather = useWeatherStore((state) => state.weather);
  const billing = useWeatherStore((state) => state.billing);
  const user = useWeatherStore((state) => state.user);
  const config = useWeatherStore((state) => state.config);
  // Console follows station daylight unless the viewer pinned a theme.
  useTheme({ sunrise: weather.sunrise, sunset: weather.sunset, timeZone: config.timezone });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeCheckout, setActiveCheckout] = useState<{ url: string; id: string } | null>(null);
  const [checkoutBanner, setCheckoutBanner] = useState<{ type: 'success' | 'error' | 'loading'; message: string } | null>(null);

  const weatherQuery = useWeatherQuery(true);

  useEffect(() => {
    const loadDemo = async () => {
      const { demoWeatherPayload } = await import('./components/onboarding.js');
      useWeatherStore.getState().setAll(demoWeatherPayload());
    };
    const onDemo = () => loadDemo();
    window.addEventListener('wwc:load-demo', onDemo);
    if (new URLSearchParams(window.location.search).get('demo') === '1') loadDemo();
    return () => window.removeEventListener('wwc:load-demo', onDemo);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('checkout');
    const checkoutId = params.get('checkout_id');

    if (checkoutStatus === 'success' && checkoutId) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setCheckoutBanner({ type: 'loading', message: 'Verifying your Polar checkout session…' });
      verifyCheckout(checkoutId)
        .then((res) => {
          if (res.ok) {
            setCheckoutBanner({
              type: 'success',
              message: '🎉 Welcome to Console Pro! Your 1-Year subscription is now active.',
            });
            if (res.billing) {
              useWeatherStore.getState().setBilling(res.billing);
            }
          } else {
            setCheckoutBanner({
              type: 'error',
              message: res.message || 'Payment is processing. Subscription will activate shortly.',
            });
          }
        })
        .catch((err: any) => {
          setCheckoutBanner({
            type: 'error',
            message: err?.message || 'Verification failed. If your payment went through, contact support.',
          });
        });
    }
  }, []);

  const expiresAt = billing?.subscriptionExpiresAt ? Number(billing.subscriptionExpiresAt) :
    billing?.freeUntil ? Number(billing.freeUntil) :
      user?.freeUntil ? Number(user.freeUntil) :
        null;
  const isTrialExpired = Boolean(
    (billing && !billing.accessOk && billing.subscriptionStatus === 'expired') ||
    (expiresAt && expiresAt > 0 && Date.now() > expiresAt && billing?.subscriptionStatus !== 'active' && billing?.subscriptionStatus !== 'paid')
  );

  const getRainUnit = (unit?: 'in' | 'mm') => (unit === 'mm' ? 'mm' : 'in');

  return (
    <div className="flex-1 flex flex-col justify-between h-full relative">
      <UpgradeProModal
        isOpen={isTrialExpired}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onStartCheckout={(url, id) => setActiveCheckout({ url, id })}
      />

      <Suspense fallback={null}>
      <PolarCheckoutModal
        isOpen={Boolean(activeCheckout)}
        onClose={() => setActiveCheckout(null)}
        checkoutUrl={activeCheckout?.url || null}
        checkoutId={activeCheckout?.id || null}
        onSuccess={() => {
          setCheckoutBanner({
            type: 'success',
            message: '🎉 Welcome to Console Pro! Your 1-Year subscription is now active.',
          });
        }}
      />
      </Suspense>

      {checkoutBanner && (
        <div
          className={`mx-4 mt-3 p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium z-40 ${
            checkoutBanner.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : checkoutBanner.type === 'loading'
              ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {checkoutBanner.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />}
            {checkoutBanner.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />}
            {checkoutBanner.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />}
            <span>{checkoutBanner.message}</span>
          </div>
          <button
            onClick={() => setCheckoutBanner(null)}
            aria-label="Dismiss notification"
            className="p-2 hover:bg-white/10 rounded-md transition-colors min-w-[24px] min-h-[24px] flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {weather.ts === 0 && !isTrialExpired && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md z-30 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0e111a] border border-[#2d343f] rounded-2xl p-6 shadow-2xl text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Wifi className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-white font-sans font-bold text-base">Connect your station — 3 quick steps</h3>
              <ol className="mt-3 flex items-center justify-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <li className="px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300">1 Connect</li>
                <li aria-hidden="true">→</li>
                <li className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">2 Units</li>
                <li aria-hidden="true">→</li>
                <li className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">3 TV share</li>
              </ol>
              <p className="text-gray-400 text-xs mt-3 leading-relaxed">
                Add your WeatherLink Cloud API key + secret (V2 recommended, DID only for multi-station keys).
                {weatherQuery.isFetching ? ' Checking for data…' : ' Then pick units and share a TV link.'}
                {weatherQuery.isError ? ' Last fetch failed — check credentials and retry.' : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('wwc:open-setup', { detail: { tab: 'link' } }))}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold transition-colors min-h-[44px]"
              >
                Open station setup
              </button>
              <button
                onClick={() => weatherQuery.refetch()}
                disabled={weatherQuery.isFetching}
                className="px-5 py-2.5 rounded-xl border border-white/20 bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition-colors min-h-[44px] disabled:opacity-50"
              >
                {weatherQuery.isFetching ? 'Checking…' : 'Retry fetch'}
              </button>
              <button
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('demo', '1');
                  window.history.replaceState({}, document.title, url.toString());
                  window.dispatchEvent(new CustomEvent('wwc:load-demo'));
                }}
                className="px-5 py-2.5 rounded-xl text-sky-300 text-sm font-semibold hover:text-white transition-colors min-h-[44px]"
              >
                Preview demo data
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              V2: WeatherLink → Account → API (key + secret). DID is 12-hex on Stations page. V1 legacy uses DID + password + token.
            </p>
          </div>
        </div>
      )}

      {isTrialExpired ? (
        <div className="flex-1 flex items-center justify-center bg-[#070b14]/90 backdrop-blur-xl border border-white/5 rounded-2xl m-3 select-none">
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-white font-bold text-xl">Trial Period Expired</h3>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
              Weather console display is locked until account Pro subscription is activated.
            </p>
          </div>
        </div>
      ) : (
        <ConsoleBoard />
      )}

      <BottomBar onOpenSettings={() => setIsSettingsOpen(true)} />
      <Suspense fallback={null}>
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </Suspense>
    </div>
  );
}

function ProtectedConsole() {
  const user = useWeatherStore((s) => s.user);
  const billing = useWeatherStore((s) => s.billing);
  const authChecked = useWeatherStore((s) => s.authChecked);
  const setUser = useWeatherStore((s) => s.setUser);
  const setBilling = useWeatherStore((s) => s.setBilling);
  const setTrialDays = useWeatherStore((s) => s.setTrialDays);
  const setAuthChecked = useWeatherStore((s) => s.setAuthChecked);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMe();
        if (!cancelled) {
          setUser(me.user);
          setBilling(me.billing);
          setTrialDays(me.trialDays ?? null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser, setBilling, setTrialDays, setAuthChecked]);

  // Authenticated console is unlisted (robots.txt also disallows /app).
  useEffect(() => {
    applyDocumentSeo({
      title: 'Weather console — Weatherlink Web Console',
      description: 'Live WeatherLink station console.',
      path: '/app',
      indexable: false,
    });
  }, []);

  if (!authChecked) {
    return <RouteFallback label="Checking your session…" />;
  }

  if (!user) return <Navigate to="/login" replace />;

  const accessBlocked = billing && !billing.accessOk;

  return (
    <div className="h-[100dvh] bg-[#e8edf3] dark:bg-[#0a0d14] flex flex-col overflow-y-auto md:overflow-hidden">
      <ConfigNavbar />
      {accessBlocked && (
        <div className="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-100 text-xs px-4 py-2 border-b border-amber-200 dark:border-amber-800 text-center">
          {billing.accessReason || 'Subscription required'} · Free trial / yearly Pro device plans apply
        </div>
      )}
      {user.deleteRequestedAt && (
        <div className="bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-100 text-xs px-4 py-2 border-b border-rose-200 dark:border-rose-800 text-center">
          Account deletion scheduled
          {user.deleteEffectiveAt ? ` for ${new Date(user.deleteEffectiveAt).toLocaleString()}` : ''}.{' '}
          <a href="/account" className="underline font-semibold">
            Manage in Account
          </a>
        </div>
      )}
      <div className="flex-1 flex flex-col justify-center">
        <main id="main-content" aria-label="Weather console" className="flex-1 flex flex-col justify-center min-h-0">
          <TabletFrame>
            <MainDashboard />
          </TabletFrame>
        </main>
      </div>
    </div>
  );
}

function RouteAnnouncer() {
  const location = useLocation();
  const [message, setMessage] = useState('');
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Home',
      '/features': 'Features',
      '/pricing': 'Pricing',
      '/blogs': 'Blog',
      '/about': 'About',
      '/contact': 'Contact',
      '/privacy': 'Privacy Policy',
      '/terms': 'Terms of Service',
      '/changelog': 'Changelog',
      '/login': 'Sign in',
      '/register': 'Create account',
      '/verify': 'Verify email',
      '/forgot-password': 'Forgot password',
      '/reset-password': 'Reset password',
      '/account': 'Account',
      '/app': 'Weather console',
    };
    const base = `/${location.pathname.split('/')[1] || ''}`;
    let title = titles[location.pathname] || titles[base];
    if (!title) {
      if (base === '/tv') title = 'TV display';
      else if (base === '/post') title = 'Blog post';
      else if (base === '/app') title = 'Weather console';
      else title = 'Page';
    }
    document.title = `${title} — Weatherlink Web Console`;
    setMessage(`Navigated to ${title}`);
    const main = document.querySelector('main h1, main [data-page-title]');
    if (main instanceof HTMLElement) {
      main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    }
  }, [location.pathname]);
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {message}
    </span>
  );
}

function HostAwareRoutes() {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  // Dedicated admin host: login only (no public registration). Cloudflare Access OTP sits in front.
  if (host === 'admin.wwebconsole.com' || host.startsWith('admin.') || host === 'admin.localhost') {
    return (
      <Suspense fallback={<RouteFallback label="Loading admin…" />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/verify" element={<Navigate to="/login" replace />} />
        <Route path="/*" element={<AdminPage />} />
      </Routes>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<RouteFallback label="Loading…" />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/admin" element={<AdminHostRedirect />} />
      <Route path="/admin/*" element={<AdminHostRedirect />} />
      <Route path="/tv/:slug" element={<TvPage />} />
      <Route path="/app" element={<ProtectedConsole />} />
      <Route path="/app/*" element={<ProtectedConsole />} />
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/blogs" element={<BlogListPage />} />
        <Route path="/post/:slug" element={<BlogPostPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RouteAnnouncer />
        <HostAwareRoutes />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
