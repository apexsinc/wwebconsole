import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { API_PREFIX, API_ROUTE_PREFIXES, isApiPath, rewriteLegacyApiPath } from '../shared/apiPaths.ts';
import {
  cancelAccountDeletion,
  changePassword,
  confirmEmailChange,
  createSession,
  destroySession,
  findOrCreateGoogleUser,
  loginUser,
  markEmailVerified,
  optionalAuth,
  publicUser,
  purgeDeletedAccounts,
  purgeExpiredAuthRows,
  purgeOldContactMessages,
  registerUser,
  requestAccountDeletion,
  requestEmailChange,
  requireAdmin,
  requireAuth,
  updatePassword,
} from './auth';
import { sendEmail, sendOtpEmail } from './email';
import {
  activateYearlySubscription,
  hasAccountAccess,
  normalizeWlPlan,
  publicBilling,
  setStationWlPlan,
} from './billing';
import { createPolarCheckoutSession, verifyAndApplyCheckout, handlePolarWebhook } from './polar';
import { decryptJson, hmacSha256Hex, newId, randomSlug, verifyStandardWebhookSignature } from './crypto';
import { createAndSendOtp, consumeOtp } from './otp';
import {
  buildRobotsTxt,
  buildSitemapXml,
  getPublicAuthConfig,
  getPublicSiteConfig,
  getSeoForPath,
  getSetting,
  GOOGLE_REDIRECT_URI_CHECK_SETTING,
  injectSeoIntoHtml,
  isEnabled,
  isKnownIndexableRoute,
  isNoIndexPath,
  listSettingsForAdmin,
  seoForNoIndexPath,
  seoPageFromPath,
  setSetting,
  SITE_SETTING_GROUPS,
} from './settings';
import {
  buildBlogRss,
  fetchAndStoreCover,
  getBlogSeo,
  getPublishedPost,
  listAllPosts,
  listPublishedPostMeta,
  listPublishedPosts,
  listPublishedSlugs,
  listRelatedPosts,
  resolveCoverImage,
  type BlogPostRow,
} from './blog.ts';
import {
  clientIp,
  corsOriginAllowlist,
  enforceRateLimit,
  escapeHtml,
  isDevEnvironment,
  limitJsonBody,
  safePublicError,
  securityHeaders,
  withSpaSecurityHeaders,
  WRITABLE_SETTING_KEYS,
} from './security';
import { verifyTurnstile } from './turnstile';
import { adminBaseUrl, isAdminHostname } from './hosts.ts';
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  googleRedirectUri,
  googleJwtNonce,
  GoogleOAuthError,
  GOOGLE_REDIRECT_URI_CHECK_INTERVAL_MS,
  parseGoogleRedirectUriCheckState,
  probeGoogleRedirectUri,
  serializeGoogleRedirectUriCheckState,
  shouldRunGoogleRedirectCheck,
  signOAuthState,
  verifyGoogleIdToken,
  verifyOAuthState,
  type GoogleRedirectUriCheckState,
} from './google.ts';
import type { Env, ShareLinkRow, StationCredentials, StationRow, UserRow } from './types';
import {
  connectionFromRow,
  getStationForUser,
  parseStoredWeather,
  refreshStation,
  saveCredentials,
  toPublicConfig,
} from './weatherlink';

type AppVars = { user: UserRow };
const app = new Hono<{ Bindings: Env; Variables: AppVars }>();
const api = new Hono<{ Bindings: Env; Variables: AppVars }>();

app.use('*', securityHeaders);
for (const prefix of API_ROUTE_PREFIXES) {
  app.use(
    `${prefix}/*`,
    cors({
      origin: (origin) => corsOriginAllowlist(origin) || '',
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
      maxAge: 86400,
    })
  );
  app.use(`${prefix}/*`, limitJsonBody);
}

api.get('/health', (c) => c.json({ ok: true, app: c.env.APP_NAME }));

api.get('/auth/config', async (c) => {
  const limited = enforceRateLimit(c, 'apiDefault');
  if (limited) return limited;
  return c.json(await getPublicAuthConfig(c.env));
});

api.get('/public/site', async (c) => {
  const limited = enforceRateLimit(c, 'apiDefault');
  if (limited) return limited;
  const country = c.req.header('cf-ipcountry') || c.req.header('CF-IPCountry') || null;
  return c.json(await getPublicSiteConfig(c.env, country));
});

api.post('/public/contact', async (c) => {
  const limited = enforceRateLimit(c, 'contact');
  if (limited) return limited;

  const body = z
    .object({
      name: z.string().max(80).optional(),
      email: z.string().email().max(254),
      subject: z.string().max(120).optional(),
      message: z.string().min(10).max(4000),
      turnstileToken: z.string().max(2048).optional(),
      website: z.string().max(200).optional(), // honeypot — must stay empty
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  if (body.data.website) return c.json({ ok: true }); // bot trap

  try {
    await verifyTurnstile(c.env, body.data.turnstileToken, clientIp(c));
  } catch (err) {
    return c.json({ error: safePublicError(err, 'Security check failed') }, 400);
  }

  const id = newId();
  const now = Date.now();
  const name = (body.data.name || '').trim();
  const email = body.data.email.trim().toLowerCase();
  const subject = (body.data.subject || 'Website contact').trim() || 'Website contact';
  const message = body.data.message.trim();
  const ip = clientIp(c);
  const ua = (c.req.header('user-agent') || '').slice(0, 300);

  await c.env.DB.prepare(
    `INSERT INTO contact_messages (id, name, email, subject, message, ip, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, name, email, subject, message, ip, ua, now)
    .run();

  const supportTo = (await getSetting(c.env, 'site_support_email')) || 'support@wwebconsole.com';

  try {
    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px">
        <h2 style="margin:0 0 12px">Contact form</h2>
        <p><strong>From:</strong> ${escapeHtml(name || '(no name)')} &lt;${escapeHtml(email)}&gt;</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <pre style="white-space:pre-wrap;background:#f4f7fb;padding:12px;border-radius:8px">${escapeHtml(message)}</pre>
        <p style="color:#64748b;font-size:12px">IP ${escapeHtml(ip)} · ${escapeHtml(ua.slice(0, 120))}</p>
      </div>`;
    await sendEmail(
      c.env,
      supportTo,
      `[WWebConsole] ${subject}`,
      html,
      `From: ${name} <${email}>\nSubject: ${subject}\n\n${message}`
    );
  } catch (err) {
    console.error('contact email failed', err);
    // Message is stored; still acknowledge so users aren't blocked when Resend is off
  }

  return c.json({ ok: true });
});

// ---------- Public blog (/blogs, /post/:slug) ----------
api.get('/public/blog', async (c) => {
  const limited = enforceRateLimit(c, 'publicTv');
  if (limited) return limited;
  const limitParse = z.coerce.number().int().min(1).max(50).optional().safeParse(c.req.query('limit'));
  const offsetParse = z.coerce.number().int().min(0).max(100000).optional().safeParse(c.req.query('offset'));
  const limit = limitParse.success && limitParse.data ? limitParse.data : 24;
  const offset = offsetParse.success && offsetParse.data ? offsetParse.data : 0;
  return c.json({ ...(await listPublishedPosts(c.env, limit, offset)), limit, offset });
});

api.get('/public/blog/:slug', async (c) => {
  const limited = enforceRateLimit(c, 'publicTv');
  if (limited) return limited;
  const slug = (c.req.param('slug') || '').slice(0, 160);
  const post = await getPublishedPost(c.env, slug);
  if (!post) return c.json({ error: 'Post not found' }, 404);
  return c.json({ post });
});

api.get('/public/blog/:slug/related', async (c) => {
  const limited = enforceRateLimit(c, 'publicTv');
  if (limited) return limited;
  const slug = (c.req.param('slug') || '').slice(0, 160);
  return c.json({ posts: await listRelatedPosts(c.env, slug, 3) });
});

// Cover image redirect (cached Unsplash URL, else live fetch, else 404 → gradient fallback).
api.get('/public/blog/cover/:slug', async (c) => {
  const limited = enforceRateLimit(c, 'publicTv');
  if (limited) return limited;
  const slug = (c.req.param('slug') || '').slice(0, 160);
  const row = await c.env.DB.prepare('SELECT * FROM blog_posts WHERE slug = ? COLLATE NOCASE')
    .bind(slug)
    .first<BlogPostRow>();
  if (!row) return c.text('Not found', 404);
  const url = await resolveCoverImage(c.env, row);
  if (!url) return c.text('No cover', 404);
  return c.redirect(url, 302);
});

app.get('/robots.txt', async (c) => {
  const hostname = new URL(c.req.url).hostname;
  const body = await buildRobotsTxt(c.env, hostname);
  return c.text(body, 200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
});

app.get('/sitemap.xml', async (c) => {
  const body = await buildSitemapXml(c.env, await listPublishedPostMeta(c.env));
  return c.text(body, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  });
});

app.get('/blog.xml', async (c) => {
  const body = await buildBlogRss(c.env);
  return c.text(body, 200, {
    'Content-Type': 'application/rss+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  });
});

export { isAdminHostname } from './hosts.ts';

// ---------- Auth ----------
api.post('/auth/register', async (c) => {
  // Admin subdomain is invite/allowlist only — never create accounts here
  if (isAdminHostname(new URL(c.req.url).hostname)) {
    return c.json({ error: 'Registration is not available on the admin site. Use wwebconsole.com.' }, 403);
  }
  const limited = enforceRateLimit(c, 'authRegister');
  if (limited) return limited;

  const body = z
    .object({
      email: z.string().email().max(254),
      password: z.string().min(8).max(128),
      name: z.string().max(80).optional(),
      turnstileToken: z.string().max(2048).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  try {
    await verifyTurnstile(c.env, body.data.turnstileToken, clientIp(c));
    const outcome = await registerUser(c.env, body.data.email, body.data.password, body.data.name || '');
    const normalizedEmail = body.data.email.trim().toLowerCase();

    // Uniform non-revealing response for exists / blocked (anti-enumeration)
    if (outcome.kind !== 'created') {
      return c.json({
        ok: true,
        email: normalizedEmail,
        message:
          'If this email can be registered, check your inbox for next steps. If you already have an account, sign in.',
      });
    }

    const user = outcome.user;
    if (user.needsVerification) {
      await createAndSendOtp(c.env, user.email, 'verify');
      return c.json({
        needsVerification: true,
        email: user.email,
        message: 'Check your email for a verification code',
      });
    }
    await createSession(c, user.id);
    const full = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>();
    return c.json({ user: publicUser(full!), needsVerification: false });
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Registration failed') }, 400);
  }
});

api.post('/auth/verify-email', async (c) => {
  const limited = enforceRateLimit(c, 'authOtp');
  if (limited) return limited;

  const body = z
    .object({
      email: z.string().email().max(254),
      code: z.string().min(4).max(12),
      turnstileToken: z.string().max(2048).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  try {
    await verifyTurnstile(c.env, body.data.turnstileToken, clientIp(c));
    await consumeOtp(c.env, body.data.email, 'verify', body.data.code);
    await markEmailVerified(c.env, body.data.email);
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
      .bind(body.data.email.trim())
      .first<UserRow>();
    if (!user) return c.json({ error: 'Invalid or expired code' }, 400);
    await createSession(c, user.id);
    return c.json({ user: publicUser(user) });
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Verification failed') }, 400);
  }
});

api.post('/auth/resend-verification', async (c) => {
  const limited = enforceRateLimit(c, 'authForgot');
  if (limited) return limited;
  const body = z
    .object({
      email: z.string().email().max(254),
      turnstileToken: z.string().max(2048).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  try {
    await verifyTurnstile(c.env, body.data.turnstileToken, clientIp(c));
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
      .bind(body.data.email.trim())
      .first<UserRow>();
    if (!user) return c.json({ ok: true }); // don't leak
    if (user.email_verified) return c.json({ ok: true, alreadyVerified: true });
    await createAndSendOtp(c.env, user.email, 'verify');
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Failed to send code') }, 400);
  }
});

api.post('/auth/login', async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const body = z
    .object({
      email: z.string().email().max(254),
      password: z.string().min(1).max(128),
      turnstileToken: z.string().max(2048).optional(),
    })
    .safeParse(raw);
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  const limited = enforceRateLimit(c, 'authLogin', body.data.email.toLowerCase());
  if (limited) return limited;

  try {
    await verifyTurnstile(c.env, body.data.turnstileToken, clientIp(c));
    const user = await loginUser(c.env, body.data.email, body.data.password);
    await createSession(c, user.id);
    return c.json({ user: publicUser(user) });
  } catch (err: any) {
    const status = err.code === 'EMAIL_NOT_VERIFIED' ? 403 : 401;
    return c.json(
      { error: safePublicError(err, 'Login failed'), code: err.code },
      status
    );
  }
});

api.post('/auth/forgot-password', async (c) => {
  const limited = enforceRateLimit(c, 'authForgot');
  if (limited) return limited;
  const body = z
    .object({
      email: z.string().email().max(254),
      turnstileToken: z.string().max(2048).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  try {
    await verifyTurnstile(c.env, body.data.turnstileToken, clientIp(c));
    const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE email = ? COLLATE NOCASE')
      .bind(body.data.email.trim())
      .first<{ id: string; email: string }>();
    if (user) await createAndSendOtp(c.env, user.email, 'reset');
    return c.json({ ok: true, message: 'If that email exists, a reset code was sent' });
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Request failed') }, 400);
  }
});

api.post('/auth/reset-password', async (c) => {
  const limited = enforceRateLimit(c, 'authOtp');
  if (limited) return limited;
  const body = z
    .object({
      email: z.string().email().max(254),
      code: z.string().min(4).max(12),
      password: z.string().min(8).max(128),
      turnstileToken: z.string().max(2048).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  try {
    await verifyTurnstile(c.env, body.data.turnstileToken, clientIp(c));
    await consumeOtp(c.env, body.data.email, 'reset', body.data.code);
    await updatePassword(c.env, body.data.email, body.data.password);
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Reset failed') }, 400);
  }
});

api.post('/auth/logout', async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

// ---------- Sign in with Google (OAuth 2.0 code flow) ----------
// One cookie PER FLOW: a single fixed-name cookie means a second attempt
// (new tab / retry / old Google tab still open) overwrites the first flow's
// cookie and the first callback then fails the double-submit check.
const OAUTH_STATE_COOKIE_PREFIX = 'wwc_oauth_state_';
/** Nonce cookie for the Google Identity Services (rendered button) flow. */
const OAUTH_NONCE_COOKIE = 'wwc_google_nonce';

// Fast in-isolate guard; the persisted state below is the cross-isolate guard.
let lastGoogleRedirectCheckStartedAt = 0;
let lastGoogleRedirectCheckUri = '';

function googleClientId(c: { env: Env }) {
  return c.env.GOOGLE_CLIENT_ID || '';
}

/** Public API base for OAuth endpoints: the api subdomain (falls back to APP_URL in local dev). */
function apiBaseUrl(env: Env): string {
  return (env.API_URL || env.APP_URL || 'https://wwebconsole.com').replace(/\/+$/, '');
}

api.get('/auth/google/start', async (c) => {
  const appUrl = c.env.APP_URL || 'https://wwebconsole.com';
  // Full-page navigation: redirect (never JSON) so the browser always lands somewhere useful.
  const limited = enforceRateLimit(c, 'oauthStart');
  if (limited) return c.redirect(`${appUrl}/login?error=google_rate_limited`, 302);
  const clientId = googleClientId(c);
  if (!clientId) return c.redirect(`${appUrl}/login?error=google_not_configured`, 302);
  const q = z
    .object({ mode: z.enum(['login', 'register']).default('login') })
    .safeParse({ mode: c.req.query('mode') || undefined });
  const mode = q.success ? q.data.mode : 'login';
  // Entry portal is sealed into signed state: the callback always runs on the
  // api host, so it cannot tell where the flow started. Allowlisted to 'admin'
  // (parsed separately so a bad value can't clobber a valid mode).
  const qe = z
    .object({ entry: z.enum(['admin']).optional() })
    .safeParse({ entry: c.req.query('entry') || undefined });
  const adminEntry = qe.success ? qe.data.entry === 'admin' : false;
  const nonce = randomSlug(24);
  const state = await signOAuthState(c.env.SESSION_SECRET, hmacSha256Hex, {
    nonce,
    mode,
    next: '/app',
    exp: Date.now() + 10 * 60 * 1000,
    adminEntry,
  });
  // Share the state cookie across apex + www + api: Google returns to the
  // api-subdomain callback URI, so a host-only cookie would be missing there.
  const reqHost = new URL(c.req.url).hostname;
  const stateDomain = reqHost.endsWith('wwebconsole.com') ? '.wwebconsole.com' : undefined;
  setCookie(c, `${OAUTH_STATE_COOKIE_PREFIX}${nonce}`, state, {
    path: '/',
    httpOnly: true,
    secure: !isDevEnvironment(c.env, c.req.url),
    sameSite: 'Lax',
    maxAge: 600,
    ...(stateDomain ? { domain: stateDomain } : {}),
  });
  // OAuth endpoints live on the api subdomain; page redirects stay on APP_URL.
  return c.redirect(buildGoogleAuthUrl({ clientId, redirectUri: googleRedirectUri(apiBaseUrl(c.env)), state }), 302);
});

// Reachable through the canonical /v1 prefix and the legacy /api rewrite.
// googleRedirectUri() emits the /v1 callback registered in Google Cloud.
api.get('/auth/google/callback', async (c) => {
  const appUrl = c.env.APP_URL || 'https://wwebconsole.com';
  // Pre-verification failures don't know the entry page yet: fail closed to main login.
  const fail = (code: string) => c.redirect(`${appUrl}/login?error=${code}`, 302);
  const limited = enforceRateLimit(c, 'oauthCallback');
  if (limited) return fail('google_rate_limited');

  const clientId = googleClientId(c);
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) return fail('google_not_configured');

  const code = c.req.query('code') || '';
  const returnedState = c.req.query('state') || '';
  if (!code || !returnedState) return fail('google_denied');
  // Verify the signature BEFORE touching cookies, then read the cookie that
  // belongs to this exact flow (nonce-keyed), so concurrent tabs don't collide.
  const verified = await verifyOAuthState(c.env.SESSION_SECRET, hmacSha256Hex, returnedState);
  if (!verified) return fail('google_failed');
  const stateCookie = `${OAUTH_STATE_COOKIE_PREFIX}${verified.nonce}`;
  const cookieState = getCookie(c, stateCookie) || '';
  // Double-submit CSRF check: query state must equal the signed HttpOnly cookie.
  if (!cookieState || returnedState !== cookieState) return fail('google_failed');
  // Clear with the same domain the cookie was set with, or it lingers.
  const cbHost = new URL(c.req.url).hostname;
  const cbDomain = cbHost.endsWith('wwebconsole.com') ? '.wwebconsole.com' : undefined;
  deleteCookie(c, stateCookie, cbDomain ? { path: '/', domain: cbDomain } : { path: '/' });

  // Entry-aware routing (from sealed state, never user input): admin-portal
  // flows land back on the admin host; register flows keep their page so the
  // error context isn't lost. The admin host has no /register route.
  const entryBase = verified.adminEntry ? adminBaseUrl(appUrl) : appUrl;
  const entryPage = verified.adminEntry ? 'login' : verified.mode;
  const failAs = (errorCode: string) => c.redirect(`${entryBase}/${entryPage}?error=${errorCode}`, 302);

  const expectedRedirectUri = googleRedirectUri(apiBaseUrl(c.env));
  try {
    const { idToken } = await exchangeGoogleCode(clientId, clientSecret, code, expectedRedirectUri);
    const profile = await verifyGoogleIdToken(idToken, clientId);
    // The callback always runs on the api host, so the entry portal comes from
    // sealed state: on the admin portal only existing users may sign in.
    const outcome = await findOrCreateGoogleUser(c.env, profile, { allowCreate: !verified.adminEntry });
    if (outcome.kind === 'blocked') {
      return failAs(verified.adminEntry ? 'google_admin_only' : 'google_blocked');
    }
    await createSession(c, outcome.user.id);
    // Mirror password login: admins return to the admin portal, everyone else to the console.
    if (verified.adminEntry && outcome.user.role === 'admin') return c.redirect(`${entryBase}/`, 302);
    return c.redirect(`${appUrl}${verified.next}`, 302);
  } catch (err: any) {
    if (err instanceof GoogleOAuthError) {
      const detail =
        err.code === 'google_redirect_mismatch'
          ? 'Google rejected the redirect URI as not registered for this OAuth client; verify that the exact URI below is listed under Authorized redirect URIs in Google Cloud.'
          : err.code === 'google_invalid_grant'
            ? 'Google rejected the authorization code (invalid_grant); it may be expired, reused, or tied to a different redirect URI. Restart the sign-in flow and verify the URI below.'
            : `Google token exchange failed (${err.code}).`;
      console.error(
        `Google OAuth callback token exchange failed (${err.code}, HTTP ${err.status}): ${detail} ` +
          `Expected/sent redirect URI: ${expectedRedirectUri}`
      );
    } else {
      console.error('Google OAuth callback failed:', err?.message || err);
    }
    return failAs('google_failed');
  }
});

/** Google Identity Services (GIS) credential endpoint.
 *
 *  The rendered "Sign in with Google" button returns a Google ID token directly
 *  in the browser (no authorization code, no client secret). We verify it with
 *  the SAME server-side check the redirect flow uses — Google's tokeninfo plus
 *  an exact `aud === GOOGLE_CLIENT_ID` match — so the browser never holds any
 *  privileged credential and we never trust a client-supplied profile.
 *
 *  CSRF/binding: a nonce cookie is minted per request; the ID token's `nonce`
 *  claim must equal both the cookie and the body value. This binds the token to
 *  the browsing context that asked for it.
 */
api.post('/auth/google/credential', async (c) => {
  const appUrl = c.env.APP_URL || 'https://wwebconsole.com';
  const limited = enforceRateLimit(c, 'oauthCallback');
  if (limited) return limited;

  const clientId = googleClientId(c);
  if (!clientId) return c.json({ error: 'Google sign-in is not configured', code: 'google_not_configured' }, 400);

  const body = z
    .object({
      credential: z.string().min(20).max(4096),
      nonce: z.string().min(8).max(128),
      // Which portal the user started from; same allowlist as the redirect flow.
      entry: z.enum(['admin']).optional(),
      mode: z.enum(['login', 'register']).default('login'),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  const cookieNonce = getCookie(c, OAUTH_NONCE_COOKIE) || '';
  const tokenNonce = googleJwtNonce(body.data.credential) || '';
  if (!cookieNonce || cookieNonce !== body.data.nonce || tokenNonce !== body.data.nonce) {
    return c.json({ error: 'Google sign-in failed. Please try again.', code: 'google_failed' }, 400);
  }

  // One-shot nonce: clear before verification so a captured token can't be replayed.
  const reqHost = new URL(c.req.url).hostname;
  const nonceDomain = reqHost.endsWith('wwebconsole.com') ? '.wwebconsole.com' : undefined;
  deleteCookie(c, OAUTH_NONCE_COOKIE, nonceDomain ? { path: '/', domain: nonceDomain } : { path: '/' });

  const adminEntry = body.data.entry === 'admin';
  try {
    const profile = await verifyGoogleIdToken(body.data.credential, clientId);
    const outcome = await findOrCreateGoogleUser(c.env, profile, { allowCreate: !adminEntry });
    if (outcome.kind === 'blocked') {
      return c.json(
        {
          error: adminEntry
            ? 'Only existing admin accounts can sign in with Google here.'
            : 'This email cannot use Google sign-in. Contact support.',
          code: adminEntry ? 'google_admin_only' : 'google_blocked',
        },
        403
      );
    }
    await createSession(c, outcome.user.id);
    const redirectTo = adminEntry && outcome.user.role === 'admin'
      ? `${adminBaseUrl(appUrl)}/`
      : `${appUrl}/app`;
    return c.json({ ok: true, user: publicUser(outcome.user), redirectTo });
  } catch (err: any) {
    console.error('Google GIS credential login failed:', err?.message || err);
    return c.json({ error: 'Google sign-in failed. Please try again.', code: 'google_failed' }, 400);
  }
});

/** Mint a short-lived nonce cookie for the GIS credential flow.
 *  Separate from /start (which issues a full signed state) because GIS tokens
 *  are verified by nonce binding rather than the double-submit state check. */
api.post('/auth/google/nonce', async (c) => {
  const limited = enforceRateLimit(c, 'oauthStart');
  if (limited) return limited;
  const nonce = randomSlug(24);
  const reqHost = new URL(c.req.url).hostname;
  const nonceDomain = reqHost.endsWith('wwebconsole.com') ? '.wwebconsole.com' : undefined;
  setCookie(c, OAUTH_NONCE_COOKIE, nonce, {
    path: '/',
    httpOnly: true,
    secure: !isDevEnvironment(c.env, c.req.url),
    sameSite: 'Lax',
    maxAge: 600,
    ...(nonceDomain ? { domain: nonceDomain } : {}),
  });
  return c.json({ ok: true, nonce });
});

api.get('/auth/me', optionalAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ user: null, billing: null });
  const station = await getStationForUser(c.env, user.id);
  const trialDays = Number(await getSetting(c.env, 'free_trial_days')) || 30;
  return c.json({ user: publicUser(user), billing: publicBilling(user, station), trialDays });
});

// ---------- Account settings ----------
api.post('/account/password', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'accountSensitive', c.get('user').id);
  if (limited) return limited;
  const body = z
    .object({
      currentPassword: z.string().min(1).max(128),
      newPassword: z.string().min(8).max(128),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  try {
    await changePassword(c.env, c.get('user').id, body.data.currentPassword, body.data.newPassword);
    await createSession(c, c.get('user').id);
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Password change failed') }, 400);
  }
});

api.post('/account/email/request', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'accountSensitive', c.get('user').id);
  if (limited) return limited;
  const body = z.object({ email: z.string().email().max(254) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  try {
    const { email, code } = await requestEmailChange(c.env, c.get('user').id, body.data.email);
    const resendOn = await isEnabled(c.env, 'resend_enabled');
    if (resendOn) {
      await sendOtpEmail(c.env, email, 'verify', code);
      return c.json({ ok: true, needsVerification: true, email });
    }
    // Only expose OTP in explicit local/dev environments — never in production
    if (isDevEnvironment(c.env, c.req.url)) {
      return c.json({ ok: true, needsVerification: true, email, devCode: code });
    }
    return c.json({
      ok: true,
      needsVerification: true,
      email,
      error: 'Email delivery is not configured. Contact support.',
    }, 503);
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Email change failed') }, 400);
  }
});

api.post('/account/email/confirm', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'authOtp', c.get('user').id);
  if (limited) return limited;
  const body = z.object({ code: z.string().min(4).max(12) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  try {
    const result = await confirmEmailChange(c.env, c.get('user').id, body.data.code);
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(c.get('user').id).first<UserRow>();
    return c.json({ ok: true, user: publicUser(user!), email: result.email });
  } catch (err: any) {
    return c.json({ error: safePublicError(err, 'Confirmation failed') }, 400);
  }
});

api.post('/account/delete', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'accountSensitive', c.get('user').id);
  if (limited) return limited;
  const body = z.object({ confirm: z.literal('DELETE') }).safeParse(await c.req.json());
  if (!body.success) return c.json({ error: 'Type DELETE to confirm' }, 400);
  const user = c.get('user');
  if (user.role === 'admin') return c.json({ error: 'Admin accounts cannot be self-deleted' }, 400);
  const result = await requestAccountDeletion(c.env, user.id);
  const fresh = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>();
  return c.json({ ok: true, ...result, user: publicUser(fresh!) });
});

api.post('/account/delete/cancel', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'accountSensitive', c.get('user').id);
  if (limited) return limited;
  await cancelAccountDeletion(c.env, c.get('user').id);
  const fresh = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(c.get('user').id).first<UserRow>();
  return c.json({ ok: true, user: publicUser(fresh!) });
});

async function assertAccess(c: { env: Env; json: Function; get: Function }) {
  const user = c.get('user') as UserRow;
  const station = await getStationForUser(c.env, user.id);
  const access = hasAccountAccess(user, station);
  if (!access.ok) {
    return { blocked: true as const, response: c.json({ error: access.reason, code: 'ACCESS_DENIED', billing: publicBilling(user, station) }, 402) };
  }
  return { blocked: false as const, station, user };
}

// ---------- Station / weather ----------
api.get('/station', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'apiDefault', c.get('user').id);
  if (limited) return limited;
  const gate = await assertAccess(c);
  if (gate.blocked) return gate.response;
  const { station, user } = gate;
  if (!station) return c.json({ error: 'Station not found' }, 404);
  let creds: StationCredentials;
  try {
    creds = await decryptJson<StationCredentials>(
      c.env.CREDENTIALS_KEY,
      station.credentials_enc,
      station.credentials_iv
    );
  } catch {
    // Key rotated or data corrupted: surface re-entry prompt, not empty-creds misreport.
    return c.json({ error: 'Stored credentials could not be decrypted. Please re-enter all credential fields.', code: 'DECRYPT_FAILED' }, 400);
  }
  const weather = parseStoredWeather(station);
  return c.json({
    weather,
    connection: connectionFromRow(station, weather, station.last_error),
    config: toPublicConfig(station, creds),
    stationId: station.id,
    billing: publicBilling(user, station),
  });
});

api.patch('/station', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'apiDefault', c.get('user').id);
  if (limited) return limited;
  const gate = await assertAccess(c);
  if (gate.blocked) return gate.response;
  const { station: existingStation, user } = gate;
  if (!existingStation) return c.json({ error: 'Station not found' }, 404);
  const station = existingStation;

  const body = z
    .object({
      name: z.string().max(80).optional(),
      cloudApiVersion: z.enum(['v1', 'v2']).optional(),
      cloudDid: z.string().max(64).optional(),
      cloudStationId: z.string().max(64).optional(),
      cloudStationName: z.string().max(120).optional(),
      latitude: z.number().nullable().optional(),
      longitude: z.number().nullable().optional(),
      unitTemp: z.enum(['F', 'C']).optional(),
      unitWind: z.enum(['mph', 'kmh', 'kts', 'ms']).optional(),
      unitBaro: z.enum(['inHg', 'hPa', 'mmHg', 'mb']).optional(),
      unitRain: z.enum(['in', 'mm']).optional(),
      tileLayout: z.enum(['dense', 'room']).optional(),
      highContrast: z.boolean().optional(),
      cloudPassword: z.string().max(200).optional(),
      cloudApiToken: z.string().max(200).optional(),
      cloudApiSecret: z.string().max(200).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));

  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  const d = body.data;
  const now = Date.now();
  const nextVersion = d.cloudApiVersion || (station.cloud_api_version === 'v1' ? 'v1' : 'v2');

  // Enforce exclusive credential sets: v1 XOR v2
  if (nextVersion === 'v1' && d.cloudApiSecret) {
    return c.json({ error: 'API V1 does not use an API Secret. Switch to V2 or clear the secret.' }, 400);
  }
  if (nextVersion === 'v2' && d.cloudPassword && !d.cloudApiToken && !d.cloudApiSecret) {
    // password alone on v2 is optional hybrid — ok
  }

  let existingCreds: StationCredentials;
  try {
    existingCreds = await decryptJson<StationCredentials>(
      c.env.CREDENTIALS_KEY,
      station.credentials_enc,
      station.credentials_iv
    );
  } catch {
    return c.json({ error: 'Stored credentials could not be decrypted. Please re-enter all credential fields (password, token, secret).', code: 'DECRYPT_FAILED' }, 400);
  }
  let enc: string, iv: string;
  try {
    const res = await saveCredentials(c.env, existingCreds, {
      password: d.cloudPassword,
      apiToken: d.cloudApiToken,
      apiSecret: nextVersion === 'v1' ? '' : d.cloudApiSecret,
      apiVersion: nextVersion,
    });
    enc = res.enc;
    iv = res.iv;
  } catch (err: any) {
    console.error('Station credential save failed:', err?.message || err);
    return c.json({ error: 'Failed to save credentials. Please retry.' }, 500);
  }

  await c.env.DB.prepare(
    `UPDATE stations SET
      name = COALESCE(?, name),
      cloud_api_version = COALESCE(?, cloud_api_version),
      cloud_did = COALESCE(?, cloud_did),
      cloud_station_id = COALESCE(?, cloud_station_id),
      cloud_station_name = COALESCE(?, cloud_station_name),
      latitude = CASE WHEN ? THEN ? ELSE latitude END,
      longitude = CASE WHEN ? THEN ? ELSE longitude END,
      credentials_enc = ?,
      credentials_iv = ?,
      unit_temp = COALESCE(?, unit_temp),
      unit_wind = COALESCE(?, unit_wind),
      unit_baro = COALESCE(?, unit_baro),
      unit_rain = COALESCE(?, unit_rain),
      tile_layout = COALESCE(?, tile_layout),
      contrast = COALESCE(?, contrast),
      updated_at = ?
     WHERE id = ?`
  )
    .bind(
      d.name ?? null,
      d.cloudApiVersion ?? null,
      d.cloudDid ?? null,
      d.cloudStationId ?? null,
      d.cloudStationName ?? null,
      d.latitude !== undefined ? 1 : 0,
      d.latitude ?? null,
      d.longitude !== undefined ? 1 : 0,
      d.longitude ?? null,
      enc,
      iv,
      d.unitTemp ?? null,
      d.unitWind ?? null,
      d.unitBaro ?? null,
      d.unitRain ?? null,
      d.tileLayout ?? null,
      d.highContrast === undefined ? null : (d.highContrast ? 'high' : 'standard'),
      now,
      station.id
    )
    .run();

  // wlPlan is admin/subscription-controlled only — not user-writable

  let updated = await getStationForUser(c.env, user.id);
  if (!updated) return c.json({ error: 'Station not found' }, 404);

  const result = await refreshStation(c.env, updated);
  updated = (await getStationForUser(c.env, user.id))!;
  // Creds were just encrypted above; a decrypt miss here means key rotation mid-request.
  const creds = await decryptJson<StationCredentials>(
    c.env.CREDENTIALS_KEY,
    updated.credentials_enc,
    updated.credentials_iv
  ).catch(() => ({} as StationCredentials));

  return c.json({
    weather: result.weather,
    connection: connectionFromRow(updated, result.weather, result.error),
    config: toPublicConfig(updated, creds),
    stationId: updated.id,
    billing: publicBilling(user, updated),
  });
});

api.get('/weather/current', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'apiDefault', c.get('user').id);
  if (limited) return limited;
  const gate = await assertAccess(c);
  if (gate.blocked) return gate.response;
  let station = gate.station;
  if (!station) return c.json({ error: 'Station not found' }, 404);

  const force = c.req.query('refresh') === '1';
  const pollMs = (station.poll_interval_sec || 900) * 1000;
  const stale = !station.last_http_at || Date.now() - station.last_http_at > pollMs;
  if (force || stale) {
    await refreshStation(c.env, station);
    station = (await getStationForUser(c.env, gate.user.id))!;
  }

  const creds = await decryptJson<StationCredentials>(
    c.env.CREDENTIALS_KEY,
    station.credentials_enc,
    station.credentials_iv
  ).catch(() => ({} as StationCredentials));
  const weather = parseStoredWeather(station);
  return c.json({
    weather,
    connection: connectionFromRow(station, weather, station.last_error),
    config: toPublicConfig(station, creds),
    stationId: station.id,
    billing: publicBilling(gate.user, station),
  });
});

api.post('/billing/activate', requireAuth, async (c) => {
  // Manual/admin-assisted activation until payment provider is wired
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json(
      {
        error: 'Yearly checkout coming soon. Contact support or an admin to activate after payment.',
        code: 'CHECKOUT_PENDING',
      },
      501
    );
  }
  const body = z
    .object({
      stationId: z.string().optional(),
      wlPlan: z.enum(['pro']).default('pro'),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  const station =
    (body.data.stationId
      ? await c.env.DB.prepare('SELECT * FROM stations WHERE id = ?').bind(body.data.stationId).first<StationRow>()
      : await getStationForUser(c.env, user.id)) || null;
  if (!station) return c.json({ error: 'Station not found' }, 404);

  try {
    await activateYearlySubscription(c.env, station.id, 'pro');
    const updated = await c.env.DB.prepare('SELECT * FROM stations WHERE id = ?').bind(station.id).first<StationRow>();
    const owner = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(station.user_id).first<UserRow>();
    return c.json({ ok: true, billing: publicBilling(owner!, updated) });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// ---------- Polar Billing & Checkout ----------
api.post('/billing/checkout', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'apiDefault', c.get('user').id);
  if (limited) return limited;
  const user = c.get('user');
  const body = z
    .object({
      stationId: z.string().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  let station = body.data.stationId
    ? await c.env.DB.prepare('SELECT * FROM stations WHERE id = ?').bind(body.data.stationId).first<StationRow>()
    : await getStationForUser(c.env, user.id);

  if (!station) {
    const now = Date.now();
    const id = newId();
    await c.env.DB.prepare(
      `INSERT INTO stations (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(id, user.id, 'Device 1', now, now)
      .run();
    station = await c.env.DB.prepare('SELECT * FROM stations WHERE id = ?').bind(id).first<StationRow>();
  }

  if (!station) return c.json({ error: 'Station not found' }, 404);

  // Never trust Origin header for payment redirect base (open-redirect risk).
  const appUrl = c.env.APP_URL || 'https://wwebconsole.com';

  try {
    const result = await createPolarCheckoutSession(c.env, user, station, appUrl);
    return c.json({ ok: true, checkoutUrl: result.checkoutUrl, checkoutId: result.checkoutId });
  } catch (err: any) {
    console.error('Polar checkout error:', err);
    return c.json({ error: 'Failed to initiate checkout. Please try again.' }, 500);
  }
});

api.post('/billing/verify-checkout', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'apiDefault', c.get('user').id);
  if (limited) return limited;
  const user = c.get('user');
  const body = z
    .object({
      checkoutId: z.string().min(1),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Missing checkoutId' }, 400);

  try {
    const result = await verifyAndApplyCheckout(c.env, body.data.checkoutId, user);
    if (!result.ok) {
      return c.json({ ok: false, error: result.message, status: result.status }, 400);
    }
    const station = await getStationForUser(c.env, user.id);
    return c.json({ ok: true, message: result.message, billing: publicBilling(user, station) });
  } catch (err: any) {
    console.error('Polar verify checkout error:', err);
    return c.json({ error: err.message || 'Failed to verify checkout' }, 500);
  }
});

const handleWebhookRequest = async (c: any) => {
  const limited = enforceRateLimit(c, 'apiDefault');
  if (limited) return limited;
  try {
    // Read the raw body: signature verification requires the exact bytes.
    const rawBody = await c.req.text();
    let payload: any = null;
    try {
      payload = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      return c.text('Bad Request', 400);
    }
    if (!payload) return c.text('Bad Request', 400);

    // Verify Standard Webhooks signature when a secret is configured.
    // Without POLAR_WEBHOOK_SECRET we cannot authenticate the sender:
    // accept-and-log (backward compatible) so subscription polling still works.
    const webhookSecret = c.env.POLAR_WEBHOOK_SECRET || '';
    if (webhookSecret) {
      const ok = await verifyStandardWebhookSignature({
        secret: webhookSecret,
        webhookId: c.req.header('webhook-id') || '',
        timestamp: c.req.header('webhook-timestamp') || '',
        rawBody,
        signatureHeader: c.req.header('webhook-signature') || '',
      });
      if (!ok) return c.text('Invalid signature', 401);
    } else {
      console.warn('Polar webhook received without POLAR_WEBHOOK_SECRET configured — skipping signature check');
    }

    const result = await handlePolarWebhook(c.env, payload);
    return c.json({ ok: true, result });
  } catch (err: any) {
    console.error('Polar webhook error:', err?.message || err);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
};

api.post('/webhooks/polar', handleWebhookRequest);
api.post('/billing/webhook', handleWebhookRequest);


// ---------- Share links ----------
api.get('/share', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'apiDefault', c.get('user').id);
  if (limited) return limited;
  const gate = await assertAccess(c);
  if (gate.blocked) return gate.response;
  const user = gate.user;
  const links = await c.env.DB.prepare(
    'SELECT id, slug, label, enabled, created_at, updated_at FROM share_links WHERE user_id = ? ORDER BY created_at DESC'
  )
    .bind(user.id)
    .all<Pick<ShareLinkRow, 'id' | 'slug' | 'label' | 'enabled' | 'created_at' | 'updated_at'>>();

  const base = c.env.APP_URL.replace(/\/$/, '');
  return c.json({
    links: (links.results || []).map((l) => ({
      ...l,
      enabled: Boolean(l.enabled),
      url: `${base}/tv/${l.slug}`,
    })),
  });
});

api.post('/share', requireAuth, async (c) => {
  const gate = await assertAccess(c);
  if (gate.blocked) return gate.response;
  const { user, station } = gate;
  if (!station) return c.json({ error: 'Station not found' }, 404);

  const limited = enforceRateLimit(c, 'shareCreate', user.id);
  if (limited) return limited;

  const body = z
    .object({
      label: z.string().max(80).optional(),
      slug: z
        .string()
        .min(12)
        .max(32)
        .regex(/^[a-z0-9-]+$/i)
        .optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));

  if (!body.success) return c.json({ error: 'Invalid input (custom slug must be 12–32 chars)' }, 400);

  // Cap share links per user
  const countRow = await c.env.DB.prepare('SELECT COUNT(*) as c FROM share_links WHERE user_id = ?')
    .bind(user.id)
    .first<{ c: number }>();
  if ((countRow?.c || 0) >= 25) return c.json({ error: 'Share link limit reached' }, 400);

  const slug = (body.data.slug || randomSlug(16)).toLowerCase();
  const existing = await c.env.DB.prepare('SELECT id FROM share_links WHERE slug = ? COLLATE NOCASE')
    .bind(slug)
    .first();
  if (existing) return c.json({ error: 'Slug already taken' }, 409);

  const id = newId();
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO share_links (id, station_id, user_id, slug, label, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(id, station.id, user.id, slug, body.data.label || 'TV Display', now, now)
    .run();

  const base = c.env.APP_URL.replace(/\/$/, '');
  return c.json({
    link: { id, slug, label: body.data.label || 'TV Display', enabled: true, url: `${base}/tv/${slug}` },
  });
});

api.delete('/share/:id', requireAuth, async (c) => {
  const limited = enforceRateLimit(c, 'apiDefault', c.get('user').id);
  if (limited) return limited;
  const gate = await assertAccess(c);
  if (gate.blocked) return gate.response;
  const user = c.get('user');
  const id = z.string().uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json({ error: 'Invalid id' }, 400);
  await c.env.DB.prepare('DELETE FROM share_links WHERE id = ? AND user_id = ?')
    .bind(id.data, user.id)
    .run();
  return c.json({ ok: true });
});

api.get('/public/tv/:slug', async (c) => {
  const slugParse = z
    .string()
    .min(4)
    .max(32)
    .regex(/^[a-z0-9-]+$/i)
    .safeParse(c.req.param('slug'));
  if (!slugParse.success) return c.json({ error: 'Display not found' }, 404);

  const limited = enforceRateLimit(c, 'publicTv', slugParse.data.toLowerCase());
  if (limited) return limited;

  const link = await c.env.DB.prepare(
    'SELECT * FROM share_links WHERE slug = ? COLLATE NOCASE AND enabled = 1'
  )
    .bind(slugParse.data)
    .first<ShareLinkRow>();
  if (!link) return c.json({ error: 'Display not found' }, 404);

  const owner = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(link.user_id).first<UserRow>();
  const station = await c.env.DB.prepare('SELECT * FROM stations WHERE id = ?')
    .bind(link.station_id)
    .first<StationRow>();
  if (!owner || !station) return c.json({ error: 'Display not found' }, 404);
  if (owner.suspended) return c.json({ error: 'Display unavailable' }, 403);

  const access = hasAccountAccess(owner, station);
  if (!access.ok) return c.json({ error: 'Display unavailable', code: 'ACCESS_DENIED' }, 402);

  // Public endpoint serves cached weather only — never triggers WeatherLink refresh (abuse amplification)
  const weather = parseStoredWeather(station);
  const hasData = Boolean(weather && weather.ts > 0);
  return c.json(
    {
      weather,
      connection: {
        status: hasData ? 'online' : 'offline',
        lastUdpReceived: null,
        lastHttpReceived: station.last_http_at,
        errorMessage: null,
      },
      config: {
        unitTemp: station.unit_temp || 'C',
        unitWind: station.unit_wind || 'kmh',
        unitBaro: station.unit_baro || 'hPa',
        unitRain: station.unit_rain || 'mm',
        stationName: station.name || station.cloud_station_name,
        cloudStationName: station.cloud_station_name,
        tileLayout: station.tile_layout === 'room' ? 'room' : 'dense',
        highContrast: station.contrast === 'high',
      },
      label: link.label,
    },
    { status: 200, headers: { 'Cache-Control': 'public, max-age=30' } }
  );
});

// ---------- Admin ----------
api.get('/admin/overview', requireAdmin, async (c) => {
  const limited = enforceRateLimit(c, 'adminWrite', c.get('user').id);
  if (limited) return limited;
  const now = Date.now();
  const users = await c.env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
  const suspended = await c.env.DB.prepare('SELECT COUNT(*) as c FROM users WHERE suspended = 1').first<{ c: number }>();
  const activePaid = await c.env.DB.prepare(
    `SELECT COUNT(*) as c FROM stations WHERE subscription_status = 'active' AND subscription_expires_at > ?`
  )
    .bind(now)
    .first<{ c: number }>();
  const activeTrial = await c.env.DB.prepare(
    `SELECT COUNT(*) as c FROM users WHERE free_until > ? AND suspended = 0`
  )
    .bind(now)
    .first<{ c: number }>();
  const expiredTrial = await c.env.DB.prepare(
    `SELECT COUNT(*) as c FROM users WHERE (free_until IS NULL OR free_until <= ?) AND id NOT IN (SELECT user_id FROM stations WHERE subscription_status = 'active' AND subscription_expires_at > ?)`
  )
    .bind(now, now)
    .first<{ c: number }>();

  return c.json({
    users: users?.c || 0,
    suspended: suspended?.c || 0,
    activePaidDevices: activePaid?.c || 0,
    activeTrials: activeTrial?.c || 0,
    expiredTrials: expiredTrial?.c || 0,
  });
});

api.get('/admin/users', requireAdmin, async (c) => {
  const limited = enforceRateLimit(c, 'adminWrite', c.get('user').id);
  if (limited) return limited;
  const qParse = z.string().max(120).optional().safeParse(c.req.query('q') || undefined);
  const q = (qParse.success ? qParse.data : '')?.trim() || '';
  const limitParse = z.coerce.number().int().min(1).max(200).optional().safeParse(c.req.query('limit'));
  const offsetParse = z.coerce.number().int().min(0).max(100000).optional().safeParse(c.req.query('offset'));
  const limit = limitParse.success && limitParse.data ? limitParse.data : 100;
  const offset = offsetParse.success && offsetParse.data ? offsetParse.data : 0;
  let rows: UserRow[] = [];
  if (q) {
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const res = await c.env.DB.prepare(
      `SELECT u.* FROM users u
       LEFT JOIN stations s ON s.user_id = u.id
       WHERE u.email LIKE ? COLLATE NOCASE
          OR u.name LIKE ? COLLATE NOCASE
          OR s.name LIKE ? COLLATE NOCASE
          OR s.cloud_did LIKE ? COLLATE NOCASE
       GROUP BY u.id
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`
    )
      .bind(like, like, like, like, limit, offset)
      .all<UserRow>();
    rows = res.results || [];
  } else {
    const res = await c.env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(limit, offset).all<UserRow>();
    rows = res.results || [];
  }

  const out = [];
  // Batch stations in 1 query instead of N sequential getStationForUser calls.
  const stationByUser = new Map<string, StationRow>();
  if (rows.length > 0) {
    const ids = rows.map((u) => u.id);
    const placeholders = ids.map(() => '?').join(',');
    const { results: stationRows } = await c.env.DB.prepare(
      `SELECT * FROM stations WHERE user_id IN (${placeholders})`
    )
      .bind(...ids)
      .all<StationRow>();
    for (const s of stationRows || []) {
      if (s?.user_id && !stationByUser.has(s.user_id)) stationByUser.set(s.user_id, s);
    }
  }
  for (const u of rows) {
    const station = stationByUser.get(u.id) || null;
    const parsedWeather = station ? parseStoredWeather(station) : null;
    out.push({
      ...publicUser(u),
      notes: u.notes || '',
      createdAt: u.created_at,
      billing: publicBilling(u, station),
      stationId: station?.id || null,
      stationName: station?.name || station?.cloud_station_name || null,
      cloudApiVersion: station?.cloud_api_version || null,
      cloudDid: station?.cloud_did || null,
      cloudStationId: station?.cloud_station_id || null,
      latitude: station?.latitude ?? null,
      longitude: station?.longitude ?? null,
      timezone: station?.timezone || null,
      pollIntervalSec: station?.poll_interval_sec || null,
      unitTemp: station?.unit_temp || 'C',
      unitWind: station?.unit_wind || 'kmh',
      unitBaro: station?.unit_baro || 'hPa',
      unitRain: station?.unit_rain || 'mm',
      lastHttpAt: station?.last_http_at || null,
      lastError: station?.last_error || null,
      weather: parsedWeather,
    });
  }
  return c.json({ users: out, limit, offset, nextOffset: offset + rows.length });
});

api.patch('/admin/users/:id', requireAdmin, async (c) => {
  const limited = enforceRateLimit(c, 'adminWrite', c.get('user').id);
  if (limited) return limited;
  const idParse = z.string().uuid().safeParse(c.req.param('id') || '');
  if (!idParse.success) return c.json({ error: 'Invalid user id' }, 400);
  const body = z
    .object({
      suspended: z.boolean().optional(),
      role: z.enum(['user', 'admin']).optional(),
      notes: z.string().max(500).optional(),
      freeUntil: z.number().nullable().optional(),
      emailVerified: z.boolean().optional(),
      extendTrialDays: z.number().int().min(1).max(365).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  const d = body.data;
  const id = idParse.data;
  const now = Date.now();

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  if (!user) return c.json({ error: 'User not found' }, 404);

  let newFreeUntil = d.freeUntil;
  if (d.extendTrialDays) {
    const currentBase = Math.max(user.free_until || 0, now);
    newFreeUntil = currentBase + d.extendTrialDays * 24 * 60 * 60 * 1000;
  }

  await c.env.DB.prepare(
    `UPDATE users SET
      suspended = COALESCE(?, suspended),
      role = COALESCE(?, role),
      notes = COALESCE(?, notes),
      free_until = CASE WHEN ? THEN ? ELSE free_until END,
      email_verified = COALESCE(?, email_verified),
      updated_at = ?
     WHERE id = ?`
  )
    .bind(
      d.suspended === undefined ? null : d.suspended ? 1 : 0,
      d.role ?? null,
      d.notes ?? null,
      newFreeUntil !== undefined ? 1 : 0,
      newFreeUntil ?? null,
      d.emailVerified === undefined ? null : d.emailVerified ? 1 : 0,
      now,
      id
    )
    .run();

  if (d.suspended) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  }

  const updatedUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  const station = await getStationForUser(c.env, id);
  return c.json({ user: publicUser(updatedUser!), billing: publicBilling(updatedUser!, station) });
});

api.delete('/admin/users/:id', requireAdmin, async (c) => {
  const limited = enforceRateLimit(c, 'adminWrite', c.get('user').id);
  if (limited) return limited;
  const adminUser = c.get('user');
  const idParse = z.string().uuid().safeParse(c.req.param('id') || '');
  if (!idParse.success) return c.json({ error: 'Invalid user id' }, 400);
  const targetId = idParse.data;

  if (adminUser?.id === targetId) {
    return c.json({ error: 'You cannot delete your own admin account.' }, 400);
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(targetId).first<UserRow>();
  if (!user) return c.json({ error: 'User not found' }, 404);

  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(targetId).run();
  await c.env.DB.prepare('DELETE FROM stations WHERE user_id = ?').bind(targetId).run();
  // Keep parity with purgeDeletedAccounts: avoid orphan share/devices/otp rows.
  await c.env.DB.prepare('DELETE FROM share_links WHERE user_id = ?').bind(targetId).run().catch(() => undefined);
  await c.env.DB.prepare('DELETE FROM devices WHERE user_id = ?').bind(targetId).run().catch(() => undefined);
  await c.env.DB.prepare('DELETE FROM otp_codes WHERE user_id = ?').bind(targetId).run().catch(() => undefined);
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run();

  return c.json({ ok: true, message: 'Customer account and associated station data deleted successfully.' });
});

api.post('/admin/users/:id/activate-device', requireAdmin, async (c) => {
  const limited = enforceRateLimit(c, 'adminWrite', c.get('user').id);
  if (limited) return limited;
  const idParse = z.string().uuid().safeParse(c.req.param('id') || '');
  if (!idParse.success) return c.json({ error: 'Invalid user id' }, 400);
  const body = z
    .object({
      years: z.number().int().min(1).max(5).default(1),
      wlPlan: z.enum(['basic', 'pro']).default('pro'),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  const userId = idParse.data;
  let station = await getStationForUser(c.env, userId);
  if (!station) {
    // Mirrors /v1/billing/checkout: a registered user should always have a
    // station row (created at signup), but self-heal for legacy/edge-case
    // accounts instead of silently blocking the admin's manual grant.
    const targetUser = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first<{ id: string }>();
    if (!targetUser) return c.json({ error: 'Customer not found' }, 404);
    const now = Date.now();
    const id = newId();
    await c.env.DB.prepare(
      `INSERT INTO stations (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(id, userId, 'Device 1', now, now)
      .run();
    station = await c.env.DB.prepare('SELECT * FROM stations WHERE id = ?').bind(id).first<StationRow>();
  }
  if (!station) return c.json({ error: 'Station not found for this user' }, 404);
  if (body.data.wlPlan !== 'pro') {
    return c.json({ error: 'Paid yearly activation requires WeatherLink Pro' }, 400);
  }

  await setStationWlPlan(c.env, station.id, 'pro');
  await activateYearlySubscription(c.env, station.id, 'pro');
  if (body.data.years > 1) {
    const extra = (body.data.years - 1) * 365 * 24 * 60 * 60 * 1000;
    await c.env.DB.prepare(
      `UPDATE stations SET subscription_expires_at = subscription_expires_at + ?, updated_at = ? WHERE id = ?`
    )
      .bind(extra, Date.now(), station.id)
      .run();
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
  const updated = await getStationForUser(c.env, userId);
  return c.json({ ok: true, billing: publicBilling(user!, updated) });
});

api.get('/admin/settings', requireAdmin, async (c) => {
  const limited = enforceRateLimit(c, 'adminWrite', c.get('user').id);
  if (limited) return limited;
  return c.json({ settings: await listSettingsForAdmin(c.env), groups: SITE_SETTING_GROUPS });
});

// ---------- Admin blog (/admin → Blog tab) ----------
const blogPostSchema = z.object({
  title: z.string().min(3).max(160),
  slug: z.string().max(160).optional(),
  excerpt: z.string().max(400).optional().default(''),
  body: z.string().max(60000).optional().default(''),
  coverQuery: z.string().max(80).optional().default(''),
  coverAlt: z.string().max(160).optional().default(''),
  status: z.enum(['draft', 'scheduled', 'published']).optional().default('draft'),
  publishAt: z.number().int().min(0).optional(),
  author: z.string().max(80).optional().default(''),
  tags: z.string().max(200).optional().default(''),
});

function slugify(title: string) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || `post-${Date.now()}`;
}

api.get('/admin/blog', requireAdmin, async (c) => {
  const limited = enforceRateLimit(c, 'adminWrite', c.get('user').id);
  if (limited) return limited;
  return c.json({ posts: await listAllPosts(c.env) });
});

api.post('/admin/blog', requireAdmin, async (c) => {
  const limited = enforceRateLimit(c, 'adminWrite', c.get('user').id);
  if (limited) return limited;
  const body = blogPostSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  const d = body.data;
  const now = Date.now();
  const id = newId();
  const slug = (d.slug || slugify(d.title)).toLowerCase();
  const exists = await c.env.DB.prepare('SELECT id FROM blog_posts WHERE slug = ? COLLATE NOCASE').bind(slug).first();
  if (exists) return c.json({ error: 'A post with this slug already exists.' }, 400);
  await c.env.DB.prepare(
    `INSERT INTO blog_posts (id, slug, title, excerpt, body, cover_image_url, cover_query, cover_alt, status, publish_at, author, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, slug, d.title.trim(), (d.excerpt || '').trim(), d.body || '', d.coverQuery || '', d.coverAlt || d.title.trim(),
      d.status, d.publishAt ?? now, d.author || '', d.tags || '', now, now)
    .run();
  const row = await c.env.DB.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(id).first<BlogPostRow>();
  return c.json({ post: row });
});

api.patch('/admin/blog/:id', requireAdmin, async (c) => {
  const limited = enforceRateLimit(c, 'adminWrite', c.get('user').id);
  if (limited) return limited;
  const idParse = z.string().uuid().safeParse(c.req.param('id') || '');
  if (!idParse.success) return c.json({ error: 'Invalid post id' }, 400);
  const body = blogPostSchema.partial().safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);
  const d = body.data;
  const id = idParse.data;
  const row = await c.env.DB.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(id).first<BlogPostRow>();
  if (!row) return c.json({ error: 'Post not found' }, 404);
  if (d.slug && d.slug.toLowerCase() !== row.slug.toLowerCase()) {
    const clash = await c.env.DB.prepare('SELECT id FROM blog_posts WHERE slug = ? COLLATE NOCASE').bind(d.slug).first();
    if (clash) return c.json({ error: 'A post with this slug already exists.' }, 400);
  }
  await c.env.DB.prepare(
    `UPDATE blog_posts SET
      slug = COALESCE(?, slug), title = COALESCE(?, title), excerpt = COALESCE(?, excerpt),
      body = COALESCE(?, body), cover_query = COALESCE(?, cover_query), cover_alt = COALESCE(?, cover_alt),
      status = COALESCE(?, status), publish_at = COALESCE(?, publish_at),
      author = COALESCE(?, author), tags = COALESCE(?, tags), updated_at = ?
     WHERE id = ?`
  )
    .bind(
      d.slug?.toLowerCase() ?? null, d.title?.trim() ?? null, d.excerpt?.trim() ?? null,
      d.body ?? null, d.coverQuery ?? null, d.coverAlt ?? null,
      d.status ?? null, d.publishAt ?? null, d.author ?? null, d.tags ?? null, Date.now(), id
    )
    .run();
  const updated = await c.env.DB.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(id).first<BlogPostRow>();
  return c.json({ post: updated });
});

api.delete('/admin/blog/:id', requireAdmin, async (c) => {
  const limited = enforceRateLimit(c, 'adminWrite', c.get('user').id);
  if (limited) return limited;
  const idParse = z.string().uuid().safeParse(c.req.param('id') || '');
  if (!idParse.success) return c.json({ error: 'Invalid post id' }, 400);
  await c.env.DB.prepare('DELETE FROM blog_posts WHERE id = ?').bind(idParse.data).run();
  return c.json({ ok: true });
});

// (Re)fetch the Unsplash cover for a post (cached into cover_image_url).
api.post('/admin/blog/:id/cover', requireAdmin, async (c) => {
  const limited = enforceRateLimit(c, 'adminWrite', c.get('user').id);
  if (limited) return limited;
  const idParse = z.string().uuid().safeParse(c.req.param('id') || '');
  if (!idParse.success) return c.json({ error: 'Invalid post id' }, 400);
  const body = z.object({ query: z.string().max(80).optional(), refresh: z.boolean().optional() })
    .safeParse(await c.req.json().catch(() => ({})));
  if (body.success && body.data.query) {
    await c.env.DB.prepare('UPDATE blog_posts SET cover_query = ?, cover_image_url = ?, updated_at = ? WHERE id = ?')
      .bind(body.data.query, '', Date.now(), idParse.data)
      .run();
  } else if (body.success && body.data.refresh) {
    await c.env.DB.prepare('UPDATE blog_posts SET cover_image_url = ?, updated_at = ? WHERE id = ?')
      .bind('', Date.now(), idParse.data)
      .run();
  }
  const url = await fetchAndStoreCover(c.env, idParse.data);
  if (!url) return c.json({ error: 'Could not fetch a cover. Set UNSPLASH_ACCESS_KEY or check the query.' }, 400);
  return c.json({ ok: true, coverImageUrl: url });
});

api.put('/admin/settings', requireAdmin, async (c) => {
  const limited = enforceRateLimit(c, 'adminWrite', c.get('user').id);
  if (limited) return limited;
  const body = z
    .object({
      settings: z.record(z.string().max(80), z.string().max(50_000)),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid input' }, 400);

  for (const [key, value] of Object.entries(body.data.settings)) {
    if (!WRITABLE_SETTING_KEYS.has(key)) continue;
    if (value === '••••••••') continue; // keep existing secret
    await setSetting(c.env, key, value);
  }
  return c.json({ settings: await listSettingsForAdmin(c.env), groups: SITE_SETTING_GROUPS });
});

api.all('*', (c) => c.json({ error: 'Not found' }, 404));

/**
 * Check the exact URI this Worker sends without using the client secret.
 * The in-memory guard avoids repeated work in one isolate; the JSON status in
 * D1 carries the last-checked timestamp across isolate eviction and is also
 * returned by the existing admin settings endpoint.
 */
async function checkGoogleRedirectUriDrift(env: Env): Promise<void> {
  const expectedRedirectUri = googleRedirectUri(apiBaseUrl(env));
  const now = Date.now();
  if (
    lastGoogleRedirectCheckStartedAt > 0 &&
    lastGoogleRedirectCheckUri === expectedRedirectUri &&
    now >= lastGoogleRedirectCheckStartedAt &&
    now - lastGoogleRedirectCheckStartedAt < GOOGLE_REDIRECT_URI_CHECK_INTERVAL_MS
  ) {
    return;
  }
  lastGoogleRedirectCheckStartedAt = now;
  lastGoogleRedirectCheckUri = expectedRedirectUri;
  let previous: GoogleRedirectUriCheckState | null = null;
  try {
    previous = parseGoogleRedirectUriCheckState(
      await getSetting(env, GOOGLE_REDIRECT_URI_CHECK_SETTING)
    );
  } catch (err) {
    console.error(
      'Google redirect URI check could not read persisted status:',
      err instanceof Error ? err.message : 'unknown error'
    );
    return;
  }

  const afterRead = Date.now();
  if (
    previous &&
    previous.expectedRedirectUri === expectedRedirectUri &&
    !shouldRunGoogleRedirectCheck(previous.checkedAt, afterRead)
  ) {
    return;
  }

  let state: GoogleRedirectUriCheckState;
  const clientId = env.GOOGLE_CLIENT_ID || '';
  if (!clientId) {
    state = {
      checkedAt: Date.now(),
      status: 'not_configured',
      expectedRedirectUri,
      httpStatus: null,
    };
    console.warn('Google redirect URI check skipped: GOOGLE_CLIENT_ID is not configured');
  } else {
    const probe = await probeGoogleRedirectUri(clientId, expectedRedirectUri);
    state = {
      checkedAt: Date.now(),
      status: probe.status,
      expectedRedirectUri,
      httpStatus: probe.httpStatus,
    };
    if (probe.status === 'mismatch') {
      console.error(
        'Google OAuth redirect URI drift detected: Google returned its OAuth error redirect for the URI this Worker sends. ' +
          `Expected/sent redirect URI: ${expectedRedirectUri}. ` +
          'Add that exact URI to the OAuth client Authorized redirect URIs in Google Cloud Console, or deploy with a matching API_URL.'
      );
    } else if (probe.status === 'probe_failed') {
      const response = probe.httpStatus == null ? 'no HTTP response' : `HTTP ${probe.httpStatus}`;
      console.error(
        `Google OAuth redirect URI probe inconclusive (${response}). ` +
          `Expected/sent redirect URI: ${expectedRedirectUri}. ` +
          'Google did not return the observed sign-in or OAuth-error redirect.'
      );
    }
  }

  try {
    await setSetting(
      env,
      GOOGLE_REDIRECT_URI_CHECK_SETTING,
      serializeGoogleRedirectUriCheckState(state)
    );
  } catch (err) {
    console.error(
      'Google redirect URI check could not persist status:',
      err instanceof Error ? err.message : 'unknown error'
    );
  }
}

// ONE route table, mounted once. The permanent legacy `/api/*` alias reaches it
// through the rewrite middleware above rather than a second mount.
app.route(API_PREFIX, api);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const isGet = request.method === 'GET' || request.method === 'HEAD';
    // Canonical host: www → apex (301, preserves path + query).
    // Search Console "Page with redirect" for www.* URLs is this rule working
    // as intended — the www variant is never indexed, only the apex is.
    if (url.hostname === 'www.wwebconsole.com') {
      url.hostname = 'wwebconsole.com';
      return Response.redirect(url.toString(), 301);
    }
    // Canonical path: strip trailing slash (GET/HEAD only so POSTs keep
    // their method; query strings preserved). "/features/" → "/features" shows
    // as "Page with redirect" in Search Console — expected, not an error.
    if (isGet && url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '');
      return Response.redirect(url.toString(), 301);
    }
    // Singular alias: /blog → /blogs (301, not a 200 duplicate / soft-404).
    if (isGet && url.pathname.toLowerCase() === '/blog') {
      url.pathname = '/blogs';
      return Response.redirect(url.toString(), 301);
    }
    if (isApiPath(url.pathname) || url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml' || url.pathname === '/blog.xml') {
      // Legacy `/api/*` alias: re-dispatch to the canonical path BEFORE Hono
      // routes. Hono picks its handler chain from the original URL, so a
      // rewrite inside middleware cannot re-route; doing it here also keeps
      // exactly ONE route table, which is what makes matching deterministic.
      // (Mounting the same table at both prefixes intermittently fell through
      // to the JSON catch-all and 404'd valid routes in production.)
      const canonical = rewriteLegacyApiPath(url.pathname);
      if (canonical) {
        const rewritten = new URL(request.url);
        rewritten.pathname = canonical;
        return app.fetch(new Request(rewritten.toString(), request), env, ctx);
      }
      return app.fetch(request, env, ctx);
    }

    // api.* host is API-only: never serve the SPA shell here, so a routing
    // mistake surfaces as JSON instead of silently landing on the homepage.
    if (url.hostname === 'api.wwebconsole.com' || url.hostname === 'api.localhost') {
      if (url.pathname === '/') {
        return Response.json(
          { ok: true, service: 'wwebconsole-api', docs: 'https://wwebconsole.com' },
          { headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const assetRes = await env.ASSETS.fetch(request);
    const accept = request.headers.get('Accept') || '';
    // Skip SEO work for hashed static assets (never HTML navigations).
    const isAssetPath =
      url.pathname.startsWith('/assets/') || /\.[a-z0-9]{2,5}$/i.test(url.pathname);
    const onAdminHost = isAdminHostname(url.hostname);
    // Vite's dev server injects an inline react-refresh preamble, so the CSP
    // may only relax 'unsafe-inline' in local dev. Production always ships the
    // strict policy (asserted by ui/smoke.test.cjs).
    const devOpts = { dev: isDevEnvironment(env, request.url) };
    const isHtmlNav =
      !isAssetPath &&
      request.method === 'GET' &&
      (accept.includes('text/html') ||
        url.pathname === '/' ||
        seoPageFromPath(url.pathname) ||
        url.pathname === '/blogs' ||
        url.pathname.startsWith('/post/') ||
        isNoIndexPath(url.pathname) ||
        onAdminHost);

    if (isHtmlNav && assetRes.ok) {
      let seo = (await getSeoForPath(env, url.pathname)) || (await getBlogSeo(env, url.pathname));
      let status = assetRes.status;
      if (!seo && isNoIndexPath(url.pathname)) {
        // Private/auth pages: noindex + SELF canonical + X-Robots-Tag.
        // Previously these served the homepage shell (canonical → "/",
        // indexable), so Google reported every one as "Alternate page with
        // proper canonical tag". Self-canonical + noindex fixes the whole class.
        const site = await getPublicSiteConfig(env).catch(() => null);
        seo = seoForNoIndexPath(url.pathname, {
          siteName: site?.site_name || 'Weatherlink Web Console',
          base: site?.site_canonical_base || 'https://wwebconsole.com',
        });
      } else if (onAdminHost && !seo) {
        seo = seoForNoIndexPath(url.pathname, { siteName: 'Weatherlink Web Console' });
      }
      if (url.pathname.startsWith('/post/') && !seo) {
        // Unknown post slug: true 404 status + noindex shell (no soft-404).
        const clean = url.pathname.replace(/\/+$/, '') || '/post/unknown';
        seo = {
          title: 'Post not found — WWebConsole Blog',
          description: 'This post does not exist or is no longer published.',
          keywords: '',
          ogImage: '',
          canonical: `https://wwebconsole.com${clean}`,
          twitter: '',
          indexable: false,
          siteName: 'WWebConsole',
        };
        status = 404;
      }
      if (!seo && !isKnownIndexableRoute(url.pathname)) {
        // Unknown typo URL (e.g. /featues): real 404 + noindex, never a 200
        // soft-404 of the homepage. Soft-404s pollute "Alternate page" reports.
        const clean = url.pathname.replace(/\/+$/, '') || '/unknown';
        seo = {
          title: 'Page not found — Weatherlink Web Console',
          description: 'This page does not exist. Find station guides, features, and pricing instead.',
          keywords: '',
          ogImage: '',
          canonical: `https://wwebconsole.com${clean}`,
          twitter: '',
          indexable: false,
          siteName: 'Weatherlink Web Console',
        };
        status = 404;
      }
      if (seo) {
        const html = await assetRes.text();
        const injected = injectSeoIntoHtml(html, seo);
        const res = withSpaSecurityHeaders(
          new Response(injected, {
            status,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=60',
            },
          }),
          { dev: isDevEnvironment(env, request.url) }
        );
        // Belt-and-braces: crawlers honor the header even if they ignore the
        // meta tag (and it covers the admin host + private routes uniformly).
        if (!seo.indexable || onAdminHost) {
          res.headers.set('X-Robots-Tag', 'noindex, nofollow');
        }
        return res;
      }
      // Admin host with no matched SEO: still never index the shell.
      if (onAdminHost) {
        const res = withSpaSecurityHeaders(assetRes, devOpts);
        res.headers.set('X-Robots-Tag', 'noindex, nofollow');
        return res;
      }
      return withSpaSecurityHeaders(assetRes, devOpts);
    }

    if (assetRes.headers.get('Content-Type')?.includes('text/html')) {
      // Fallback for navigations without `Accept: text/html` (curl, some bots):
      // never serve a 200 soft-404 or an indexable private shell.
      const needsNoIndex = onAdminHost || isNoIndexPath(url.pathname);
      const isUnknown =
        !isAssetPath &&
        !isKnownIndexableRoute(url.pathname) &&
        !isNoIndexPath(url.pathname) &&
        !url.pathname.startsWith('/post/');
      if ((needsNoIndex || isUnknown) && request.method === 'GET' && assetRes.ok) {
        const site = await getPublicSiteConfig(env).catch(() => null);
        const base = site?.site_canonical_base || 'https://wwebconsole.com';
        const seo = needsNoIndex
          ? seoForNoIndexPath(url.pathname, { siteName: site?.site_name, base })
          : {
              title: 'Page not found — Weatherlink Web Console',
              description: 'This page does not exist. Find station guides, features, and pricing instead.',
              keywords: '',
              ogImage: '',
              canonical: `${base.replace(/\/+$/, '')}${url.pathname.replace(/\/+$/, '') || '/unknown'}`,
              twitter: '',
              indexable: false as const,
              siteName: site?.site_name || 'Weatherlink Web Console',
            };
        const html = await assetRes.text();
        const res = withSpaSecurityHeaders(
          new Response(injectSeoIntoHtml(html, seo), {
            status: needsNoIndex ? assetRes.status : 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
          }),
          devOpts
        );
        res.headers.set('X-Robots-Tag', 'noindex, nofollow');
        return res;
      }
      const res = withSpaSecurityHeaders(assetRes, devOpts);
      // Any HTML shell served for a private route or on the admin host is unlisted.
      if (needsNoIndex) {
        res.headers.set('X-Robots-Tag', 'noindex, nofollow');
      }
      return res;
    }

    return assetRes;
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        await purgeDeletedAccounts(env);
        await purgeExpiredAuthRows(env);
        await purgeOldContactMessages(env);
        await pollAllStations(env);
      })()
    );
    // Keep the inexpensive registration probe independent from station polling.
    ctx.waitUntil(
      checkGoogleRedirectUriDrift(env).catch((err) => {
        console.error(
          'Google redirect URI scheduled check failed:',
          err instanceof Error ? err.message : 'unknown error'
        );
      })
    );
  },
};

async function pollAllStations(env: Env) {
  const now = Date.now();
  const { results } = await env.DB.prepare(
    `SELECT s.* FROM stations s
     JOIN users u ON u.id = s.user_id
     WHERE s.credentials_enc != ''
       AND u.suspended = 0
       AND (
         (u.free_until IS NOT NULL AND u.free_until > ?)
         OR (s.subscription_status = 'active' AND s.subscription_expires_at > ?)
       )
     ORDER BY s.last_http_at ASC NULLS FIRST
     LIMIT 80`
  )
    .bind(now, now)
    .all<StationRow>();

  for (const station of results || []) {
    // Wall-time guard: stop this run after ~50s so cron never overruns the isolate.
    if (Date.now() - now > 50_000) {
      console.error('Cron pollAllStations: time budget exceeded, deferring remainder to next tick');
      break;
    }
    try {
      const interval = (station.poll_interval_sec || 900) * 1000;
      if (station.last_http_at && now - station.last_http_at < interval - 15_000) continue;
      // Basic plan hard-cap: never poll faster than 15 minutes
      if (normalizeWlPlan(station.wl_plan) === 'basic' && station.last_http_at && now - station.last_http_at < 900_000 - 15_000) {
        continue;
      }
      await refreshStation(env, station);
    } catch (err) {
      console.error('Cron refresh failed', station.id, err);
    }
  }
}
