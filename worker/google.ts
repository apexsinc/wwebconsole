/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sign in with Google (OAuth 2.0 authorization code flow).
 * Dependency-free: ID tokens are validated via Google's tokeninfo
 * endpoint instead of bundling a JWT library into the Worker.
 */

import { API_PREFIX } from '../shared/apiPaths.ts';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

/** Run the redirect-URI probe at most once every six hours across isolates. */
export const GOOGLE_REDIRECT_URI_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type GoogleOAuthErrorCode =
  | 'google_redirect_mismatch'
  | 'google_invalid_grant'
  | 'google_oauth_error';

export type GoogleRedirectProbeStatus = 'ok' | 'mismatch' | 'probe_failed';

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
};

export function googleRedirectUri(appUrl: string): string {
  // The URI registered in Google Cloud is the canonical `/v1` callback:
  //   https://api.wwebconsole.com/v1/auth/google/callback
  // Google matches redirect_uri exactly on both the authorization request and
  // the code exchange, so this single helper must be the only place it is built.
  // The route is still reachable via the legacy `/api` alias, but the value we
  // SEND must be the one registered.
  return `${appUrl.replace(/\/+$/, '')}${API_PREFIX}/auth/google/callback`;
}

/** Pure: build the Google consent URL (unit-testable, no secrets needed). */
export function buildGoogleAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: opts.state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${q.toString()}`;
}

/**
 * Classify the first redirect from Google's authorization endpoint.
 *
 * The real endpoint currently returns one of these shapes for a valid or
 * invalid redirect URI (verified with the production client):
 *   valid: 302 -> https://accounts.google.com/v3/signin/identifier?...
 *   invalid: 302 -> https://accounts.google.com/signin/oauth/error?authError=...
 *
 * An unknown shape is deliberately inconclusive rather than being called a
 * mismatch: a future Google change should not create a false alarm.
 */
export function classifyGoogleRedirectProbe(
  httpStatus: number,
  location: string | null | undefined
): GoogleRedirectProbeStatus {
  if (!Number.isFinite(httpStatus) || httpStatus < 300 || httpStatus >= 400 || !location) {
    return 'probe_failed';
  }

  let target: URL;
  try {
    target = new URL(location, GOOGLE_AUTH_URL);
  } catch {
    return 'probe_failed';
  }

  if (target.hostname.toLowerCase() !== 'accounts.google.com') return 'probe_failed';
  if (target.pathname === '/signin/oauth/error' && target.searchParams.has('authError')) {
    return 'mismatch';
  }
  if (target.pathname === '/v3/signin/identifier') return 'ok';
  return 'probe_failed';
}

export type GoogleRedirectProbeResult = {
  status: GoogleRedirectProbeStatus;
  httpStatus: number | null;
};

/** Probe registration without a client secret and without following the redirect. */
export async function probeGoogleRedirectUri(
  clientId: string,
  redirectUri: string
): Promise<GoogleRedirectProbeResult> {
  const probeUrl = buildGoogleAuthUrl({
    clientId,
    redirectUri,
    state: 'redirect-uri-health-check',
  });
  try {
    const res = await fetch(probeUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    return {
      status: classifyGoogleRedirectProbe(res.status, res.headers.get('location')),
      httpStatus: res.status,
    };
  } catch {
    return { status: 'probe_failed', httpStatus: null };
  }
}

export type GoogleRedirectUriCheckState = {
  checkedAt: number;
  status: GoogleRedirectProbeStatus | 'not_configured';
  expectedRedirectUri: string;
  httpStatus: number | null;
};

/** Pure interval guard shared by the in-memory and persisted scheduling checks. */
export function shouldRunGoogleRedirectCheck(
  lastCheckedAt: number | null | undefined,
  now: number,
  intervalMs = GOOGLE_REDIRECT_URI_CHECK_INTERVAL_MS
): boolean {
  if (!Number.isFinite(now) || !Number.isFinite(intervalMs) || intervalMs <= 0) return true;
  // A future/invalid timestamp is treated as stale so a clock jump cannot
  // suppress the health check forever.
  if (
    lastCheckedAt == null ||
    !Number.isFinite(lastCheckedAt) ||
    lastCheckedAt < 0 ||
    now < lastCheckedAt
  ) {
    return true;
  }
  return now - lastCheckedAt >= intervalMs;
}

export function serializeGoogleRedirectUriCheckState(state: GoogleRedirectUriCheckState): string {
  return JSON.stringify(state);
}

/** Parse the small, secret-free status value stored in app_settings. */
export function parseGoogleRedirectUriCheckState(
  raw: string | null | undefined
): GoogleRedirectUriCheckState | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  const checkedAt = value.checkedAt;
  const status = value.status;
  const expectedRedirectUri = value.expectedRedirectUri;
  const rawHttpStatus = value.httpStatus;
  if (typeof checkedAt !== 'number' || !Number.isFinite(checkedAt) || checkedAt < 0) return null;
  if (
    status !== 'ok' &&
    status !== 'mismatch' &&
    status !== 'probe_failed' &&
    status !== 'not_configured'
  ) {
    return null;
  }
  if (typeof expectedRedirectUri !== 'string' || !expectedRedirectUri) return null;
  if (
    rawHttpStatus !== null &&
    rawHttpStatus !== undefined &&
    (typeof rawHttpStatus !== 'number' || !Number.isFinite(rawHttpStatus))
  ) {
    return null;
  }
  return {
    checkedAt,
    status,
    expectedRedirectUri,
    httpStatus: typeof rawHttpStatus === 'number' ? rawHttpStatus : null,
  };
}

/** Extract the `nonce` claim from a Google ID token WITHOUT verifying it.
 *  Signature/audience checks still happen server-side via verifyGoogleIdToken;
 *  this pure helper only binds the token to our pre-issued nonce cookie. */
export function googleJwtNonce(credential: string): string | null {
  try {
    const parts = credential.split('.');
    if (parts.length !== 3) return null;
    const json = atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'));
    const p = JSON.parse(json) as { nonce?: unknown };
    return typeof p.nonce === 'string' && p.nonce ? p.nonce : null;
  } catch {
    return null;
  }
}

/** CSRF state: base64url(json).sig where sig = HMAC(secret, json). */
export async function signOAuthState(
  secret: string | undefined,
  sign: (secret: string, msg: string) => Promise<string>,
  payload: { nonce: string; mode: 'login' | 'register'; next: string; exp: number; adminEntry?: boolean }
): Promise<string> {
  const json = JSON.stringify(payload);
  const b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sig = await sign(secret || 'unconfigured', b64);
  return `${b64}.${sig}`;
}

export async function verifyOAuthState(
  secret: string | undefined,
  sign: (secret: string, msg: string) => Promise<string>,
  state: string
): Promise<{ nonce: string; mode: 'login' | 'register'; next: string; adminEntry: boolean } | null> {
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expected = await sign(secret || 'unconfigured', b64!);
  if (sig !== expected || sig === undefined) return null;
  try {
    const json = atob(b64!.replace(/-/g, '+').replace(/_/g, '/'));
    const p = JSON.parse(json) as { nonce?: string; mode?: string; next?: string; exp?: number; adminEntry?: boolean };
    if (typeof p.nonce !== 'string' || (p.mode !== 'login' && p.mode !== 'register')) return null;
    if (typeof p.exp !== 'number' || Date.now() > p.exp) return null;
    // Path-only redirect target (no open redirect).
    const next = typeof p.next === 'string' && p.next.startsWith('/') && !p.next.startsWith('//') ? p.next : '/app';
    // Sealed at /start from an allowlisted query param; absent on older states.
    return { nonce: p.nonce, mode: p.mode, next, adminEntry: p.adminEntry === true };
  } catch {
    return null;
  }
}

type GoogleOAuthErrorBody = { error?: unknown };

function parseGoogleOAuthErrorBody(body: string | null | undefined): GoogleOAuthErrorBody | null {
  if (typeof body !== 'string' || !body.trim()) return null;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as GoogleOAuthErrorBody;
  } catch {
    return null;
  }
}

/** Pure: map Google's OAuth error body to a stable, non-sensitive code. */
export function classifyGoogleOAuthError(body: string | null | undefined): GoogleOAuthErrorCode {
  const error = parseGoogleOAuthErrorBody(body)?.error;
  if (typeof error !== 'string') return 'google_oauth_error';
  switch (error.trim().toLowerCase()) {
    case 'redirect_uri_mismatch':
      return 'google_redirect_mismatch';
    case 'invalid_grant':
      return 'google_invalid_grant';
    default:
      return 'google_oauth_error';
  }
}

/** Typed server-side failure; its generic message is never sent to the browser. */
export class GoogleOAuthError extends Error {
  readonly code: GoogleOAuthErrorCode;
  readonly status: number;
  readonly googleError: string | undefined;

  constructor(code: GoogleOAuthErrorCode, status: number, googleError?: string) {
    super('Google authorization failed. Please try again.');
    this.name = 'GoogleOAuthError';
    this.code = code;
    this.status = status;
    this.googleError = googleError;
  }
}

export async function exchangeGoogleCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<{ idToken: string }> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    const parsed = parseGoogleOAuthErrorBody(errorBody);
    const googleError = typeof parsed?.error === 'string' ? parsed.error.trim() : undefined;
    throw new GoogleOAuthError(classifyGoogleOAuthError(errorBody), res.status, googleError);
  }
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error('Google authorization failed. Please try again.');
  return { idToken: data.id_token };
}

/** Validate the ID token with Google and extract the profile. */
export async function verifyGoogleIdToken(idToken: string, expectedClientId: string): Promise<GoogleProfile> {
  const fetchInfo = () =>
    fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`, {
      signal: AbortSignal.timeout(10000),
    });
  // tokeninfo is Google's DEBUGGING endpoint: Google documents it as subject to
  // throttling/intermittent errors. One retry absorbs a transient 429/5xx so a
  // login doesn't fail for an infrastructure blip.
  let res = await fetchInfo();
  if (res.status === 429 || res.status >= 500) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    res = await fetchInfo();
  }
  if (!res.ok) throw new Error('Google sign-in verification failed. Please try again.');
  const data = (await res.json()) as {
    sub?: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    picture?: string;
    aud?: string;
  };
  if (!data.sub || !data.email || data.aud !== expectedClientId) {
    throw new Error('Google sign-in verification failed. Please try again.');
  }
  return {
    sub: data.sub,
    email: data.email.trim().toLowerCase(),
    // Google currently sends the string "true"; accept a boolean too so a
    // format change can't silently mark every account's email unverified
    // (which would block account linking with a confusing google_failed).
    emailVerified: data.email_verified === true || data.email_verified === 'true',
    name: data.name || '',
    picture: data.picture || '',
  };
}
