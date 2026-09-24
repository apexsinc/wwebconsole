/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sign in with Google.
 *
 * Primary path: Google's own rendered button (Google Identity Services), which
 * shows the account name + avatar of the account already signed in to the
 * browser. The ID token it returns is POSTed to our own
 * /api/auth/google/credential endpoint, which verifies it server-side against
 * Google's tokeninfo (exact `aud === GOOGLE_CLIENT_ID`) plus a one-shot nonce
 * cookie, then creates the session. No client secret and no trust in anything
 * the browser sends.
 *
 * Fallback: the plain redirect flow (/api/auth/google/start) is kept as a
 * normal link, and is used whenever GIS is unavailable, blocked by CSP/ad
 * blockers, not yet loaded, or errors. The redirect flow remains fully
 * functional on its own.
 */

import { useEffect, useRef, useState } from 'react';
import { API_BASE, fetchAuthConfig, fetchGoogleNonce, loginWithGoogleCredential } from '../services/api.js';
import { useWeatherStore } from '../store.js';

const GOOGLE_ERROR_COPY: Record<string, string> = {
  google_denied: 'Google sign-in was cancelled. Try again or use email instead.',
  google_failed: 'Google sign-in failed. Try again or use email instead.',
  google_blocked: 'This email cannot use Google sign-in. Contact support.',
  google_admin_only: 'Only existing admin accounts can sign in with Google here.',
  google_rate_limited: 'Too many attempts. Wait a few minutes and try again.',
  google_not_configured: 'Google sign-in is not set up yet. Use email instead.',
};

export function googleErrorMessage(code: string | null): string {
  if (!code) return '';
  return GOOGLE_ERROR_COPY[code] || '';
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** Admin portal host check (mirrors AuthPages): entry must be flagged for the worker. */
function isAdminEntryHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'admin.wwebconsole.com' || host.startsWith('admin.') || host === 'admin.localhost';
}

let gsiLoadPromise: Promise<boolean> | null = null;

/** Load Google's GIS client exactly once; resolve false if unavailable. */
function loadGis(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as any).google?.accounts?.id) return Promise.resolve(true);
  if (gsiLoadPromise) return gsiLoadPromise;
  gsiLoadPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector(`script[src^="${GIS_SRC}"]`);
    const script = (existing || document.createElement('script')) as HTMLScriptElement;
    const done = (ok: boolean) => resolve(ok);
    script.addEventListener('load', () => done(Boolean((window as any).google?.accounts?.id)));
    script.addEventListener('error', () => done(false));
    if (!existing) {
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    // Never leave the UI stuck in a loading state if the script never fires.
    window.setTimeout(() => done(Boolean((window as any).google?.accounts?.id)), 4000);
  });
  return gsiLoadPromise;
}

export function GoogleButton({ mode }: { mode: 'login' | 'register' }) {
  const setUser = useWeatherStore((s) => s.setUser);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hostRef = useRef<HTMLDivElement | null>(null);
  const adminEntry = isAdminEntryHost();

  // The plain redirect flow stays a working anchor in every state.
  const entry = adminEntry ? '&entry=admin' : '';
  const href = `${API_BASE}/api/auth/google/start?mode=${mode}${entry}`;

  useEffect(() => {
    let cancelled = false;

    const onCredential = async (response: any) => {
      if (cancelled || busy) return;
      const credential = response?.credential;
      if (typeof credential !== 'string' || !credential) return;
      setBusy(true);
      setError('');
      try {
        // Bind the token to this browsing context before sending it.
        const { nonce } = await fetchGoogleNonce();
        const result = await loginWithGoogleCredential({
          credential,
          nonce,
          mode,
          ...(adminEntry ? { entry: 'admin' as const } : {}),
        });
        if (cancelled) return;
        if (result.user) setUser(result.user as any);
        window.location.replace(result.redirectTo || (adminEntry ? '/' : '/app'));
      } catch (err: any) {
        if (cancelled) return;
        setBusy(false);
        setError(err?.message || 'Google sign-in failed. Try again or use email instead.');
      }
    };

    (async () => {
      const [clientId, ok] = await Promise.all([
        fetchAuthConfig()
          .then((d) => String(d?.googleClientId || ''))
          .catch(() => ''),
        loadGis(),
      ]);
      if (cancelled || !ok || !clientId) return;
      try {
        const google = (window as any).google.accounts.id;
        google.initialize({
          client_id: clientId,
          callback: onCredential,
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: false,
          context: mode,
        });
        if (hostRef.current) {
          google.renderButton(hostRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: mode === 'register' ? 'signup_with' : 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: Math.max(240, hostRef.current.clientWidth || 320),
          });
        }
        if (!cancelled) setReady(true);
      } catch {
        // Any GIS error (bad origin, blocked third-party storage, etc.) keeps
        // the redirect link as the working path.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, adminEntry]);

  // Google's own markup carries the branding; our anchor is the accessible
  // fallback and must stay mounted in the DOM for no-JS / blocked-GIS cases.
  return (
    <div>
      <div ref={hostRef} className={ready ? '' : 'hidden'} aria-hidden={!ready} />
      {!ready && (
        <a
          href={href}
          onClick={() => setBusy(true)}
          aria-disabled={busy}
          aria-live="polite"
          className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-white/5 text-slate-700 dark:text-white text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/10 transition-all min-h-[44px] aria-disabled:opacity-70"
        >
          {busy ? (
            <>
              <span className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-sky-600 animate-spin" aria-hidden="true" />
              Redirecting to Google…
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.4 7.5 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.5-2.7-.1.1C.6 8.7 0 10.2 0 12s.6 3.3 1.6 4.8l3.6-2.4z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.6 1.6 6.8l3.3 2.9c.9-2.9 3.6-5 6.8-5z"
                />
              </svg>
              Continue with Google
            </>
          )}
        </a>
      )}
      {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 mt-2">{error}</p>}
      {ready && (
        // Keyboard/no-pointer users get a real link to the same flow.
        <a href={href} className="sr-only focus:not-sr-only focus:block focus:mt-2 text-xs text-center text-sky-700 dark:text-sky-300 hover:underline">
          Continue with Google (redirect sign-in)
        </a>
      )}
    </div>
  );
}

export function OAuthDivider() {
  return (
    <div className="flex items-center gap-3 my-1" aria-hidden="true">
      <span className="flex-1 h-px bg-slate-200 dark:bg-gray-800" />
      <span className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">or</span>
      <span className="flex-1 h-px bg-slate-200 dark:bg-gray-800" />
    </div>
  );
}
