/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sign in with Google (OAuth 2.0 authorization code flow).
 * Dependency-free: ID tokens are validated via Google's tokeninfo
 * endpoint instead of bundling a JWT library into the Worker.
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
};

export function googleRedirectUri(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, '')}/api/auth/google/callback`;
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
  if (!res.ok) throw new Error('Google authorization failed. Please try again.');
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error('Google authorization failed. Please try again.');
  return { idToken: data.id_token };
}

/** Validate the ID token with Google and extract the profile. */
export async function verifyGoogleIdToken(idToken: string, expectedClientId: string): Promise<GoogleProfile> {
  const res = await fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error('Google sign-in verification failed. Please try again.');
  const data = (await res.json()) as {
    sub?: string;
    email?: string;
    email_verified?: string;
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
    emailVerified: data.email_verified === 'true',
    name: data.name || '',
    picture: data.picture || '',
  };
}
