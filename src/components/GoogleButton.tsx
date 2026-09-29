/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Continue with Google — starts the backend OAuth authorization-code flow
 * (GET /v1/auth/google/start) as a plain link.
 *
 * Why a plain link and NOT Google's rendered Identity Services button:
 * the GIS button opens Google's popup account chooser, which stalls on
 * /gsi/transform when third-party cookies are blocked (increasingly the
 * default in Chrome). It also requires the ID token to carry a `nonce` that
 * must be supplied to google.accounts.id.initialize() BEFORE the credential
 * is issued; issuing it afterwards leaves the token unbound and the server
 * rejects it. The redirect flow has neither problem, is the flow Google
 * supports everywhere, and is covered by the browser regression suite.
 */

import { useState } from 'react';
import { apiUrl } from '../services/api.js';

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

/** Admin portal host check (mirrors isAdminHostname() in worker/hosts.ts). */
function isAdminEntryHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return (
    host === 'admin.wwebconsole.com' ||
    host === 'admin.localhost' ||
    host.endsWith('.admin.wwebconsole.com')
  );
}

export function GoogleButton({ mode }: { mode: 'login' | 'register' }) {
  const [busy, setBusy] = useState(false);
  // The OAuth callback always runs on the api host, so the entry portal is
  // passed explicitly and sealed into signed state (worker allowlists it).
  const entry = isAdminEntryHost() ? '&entry=admin' : '';
  const href = apiUrl(`/auth/google/start?mode=${mode}${entry}`);

  return (
    <a
      // Keep href mounted even while showing the spinner: React commits the
      // state update before the browser follows the link, so removing href in
      // the same tick cancels the navigation entirely (this regression shipped
      // once and broke login for everyone — see ui/smoke.test.cjs).
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
