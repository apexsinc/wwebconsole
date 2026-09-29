import type { Context, Next } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { isApiPath } from '../shared/apiPaths.ts';
import type { Env } from './types';
import { rateLimit, RATE_LIMITS } from './rateLimit.ts';

const MAX_JSON_BYTES = 64 * 1024; // 64 KiB

export const ALLOWED_ORIGINS = [
  'https://wwebconsole.com',
  'https://www.wwebconsole.com',
  'https://admin.wwebconsole.com',
  'http://localhost:5173',
  'http://localhost:8787',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8787',
  'http://admin.localhost:5173',
];

export function corsOriginAllowlist(origin: string): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // Local admin / preview hosts
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname.endsWith('.localhost')) {
      return origin;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function securityHeaders(c: Context<{ Bindings: Env }>, next: Next) {
  await next();
  const path = new URL(c.req.url).pathname;
  const isApi = isApiPath(path);
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (isApi) {
    c.res.headers.set('Cache-Control', 'no-store');
    c.res.headers.set(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    );
  }
}

/**
 * CSP for HTML document responses (SPA). Allows Vite assets + Turnstile.
 *
 * `scriptSrc` is a function because the production policy must NOT allow
 * 'unsafe-inline' (the theme bootstrap and the non-blocking font promotion live
 * in public/head-init.js, and every other script is an external file), while the
 * Vite DEV server must allow it: @vitejs/plugin-react injects an inline
 * react-refresh preamble that cannot be removed without breaking HMR.
 */
const SCRIPT_SRC_PRODUCTION =
  "'self' https://challenges.cloudflare.com https://cdn.jsdelivr.net https://static.cloudflareinsights.com https://accounts.google.com";
const SCRIPT_SRC_DEV = `'unsafe-inline' ${SCRIPT_SRC_PRODUCTION}`;

export function spaContentSecurityPolicy(dev = false): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    // 'unsafe-inline' is required for style attributes / injected styles in the
    // React app and is unrelated to script execution. accounts.google.com is
    // required because the rendered Google button loads its own stylesheet from
    // https://accounts.google.com/gsi/style; without it the button is unstyled.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    `script-src ${dev ? SCRIPT_SRC_DEV : SCRIPT_SRC_PRODUCTION}`,
    "connect-src 'self' https://api.wwebconsole.com https://challenges.cloudflare.com https://api.polar.sh https://sandbox-api.polar.sh https://cloudflareinsights.com https://accounts.google.com https://oauth2.googleapis.com",
    "frame-src https://challenges.cloudflare.com https://polar.sh https://sandbox.polar.sh https://accounts.google.com",
    "worker-src 'self' blob:",
  ].join('; ');
}

/** @deprecated kept as a named export for compatibility; production policy. */
export const SPA_CONTENT_SECURITY_POLICY = spaContentSecurityPolicy(false);

export function withSpaSecurityHeaders(res: Response, opts: { dev?: boolean } = {}): Response {
  const headers = new Headers(res.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('Content-Security-Policy', spaContentSecurityPolicy(Boolean(opts.dev)));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

const enforceBodyLimit = bodyLimit({
  maxSize: MAX_JSON_BYTES,
  onError: (c) => c.json({ error: 'Request body too large' }, 413),
});

export async function limitJsonBody(c: Context<{ Bindings: Env }>, next: Next) {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
    return next();
  }
  // Hono's bodyLimit also counts streamed/chunked bodies. A Content-Length
  // check alone is bypassable with an omitted or dishonest length header.
  // (Content-Length requests keep the same fast path and the same 413 body.)
  return enforceBodyLimit(c, next);
}

export function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export function enforceRateLimit(
  c: Context<any>,
  bucket: keyof typeof RATE_LIMITS,
  extraKey = ''
): Response | null {
  const cfg = RATE_LIMITS[bucket];
  const key = `${bucket}:${clientIp(c)}:${extraKey}`;
  const result = rateLimit(key, cfg.limit, cfg.windowMs);
  if (result.ok) return null;
  return c.json(
    { error: 'Too many requests. Try again later.', code: 'RATE_LIMITED' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSec) } }
  );
}

/** Hosts that must never be treated as development, whatever the bindings say. */
const NEVER_DEV_HOST_SUFFIXES = ['.wwebconsole.com', '.workers.dev'];

export function isDevEnvironment(env: Env, requestUrl: string): boolean {
  let host = '';
  try {
    host = new URL(requestUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  // A development-only flag (ENVIRONMENT/ALLOW_DEV_OTP) must never weaken a
  // known production domain: that would relax the CSP back to 'unsafe-inline'
  // and expose the devCode/dev bypass. Checking the host first also makes an
  // accidentally copied .dev.vars value harmless in production.
  if (
    host === 'wwebconsole.com' ||
    NEVER_DEV_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    return false;
  }
  if ((env as any).ENVIRONMENT === 'development' || (env as any).ALLOW_DEV_OTP === '1') return true;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
}

export function safePublicError(err: unknown, fallback = 'Request failed'): string {
  if (err instanceof Error) {
    const msg = err.message || fallback;
    // Never leak stack / internal paths
    if (/CREDENTIALS_KEY|SESSION_SECRET|stack|D1_|SQL/i.test(msg)) return fallback;
    return msg.slice(0, 200);
  }
  return fallback;
}

/** Allowlisted setting keys writable via admin API */
export const WRITABLE_SETTING_KEYS = new Set([
  'turnstile_site_key',
  'turnstile_secret_key',
  'turnstile_enabled',
  'resend_api_key',
  'resend_from_email',
  'resend_enabled',
  'yearly_price_usd',
  'free_trial_days',
  'poll_basic_sec',
  'poll_pro_sec',
  'site_name',
  'site_tagline',
  'site_description',
  'site_keywords',
  'site_og_image',
  'site_canonical_base',
  'site_twitter_handle',
  'site_support_email',
  'site_company_name',
  'site_footer_text',
  'site_trademark_note',
  'seo_home_title',
  'seo_home_description',
  'seo_features_title',
  'seo_features_description',
  'seo_pricing_title',
  'seo_pricing_description',
  'seo_about_title',
  'seo_about_description',
  'seo_contact_title',
  'seo_contact_description',
  'seo_privacy_title',
  'seo_privacy_description',
  'seo_terms_title',
  'seo_terms_description',
  'seo_changelog_title',
  'seo_changelog_description',
  'home_hero_headline',
  'home_hero_subhead',
  'home_hero_cta_primary',
  'home_hero_cta_secondary',
  'home_features_json',
  'pricing_headline',
  'pricing_subhead',
  'pricing_basic_blurb',
  'pricing_pro_blurb',
  'pricing_footnote',
  'about_body',
  'contact_intro',
  'privacy_body',
  'terms_body',
  'changelog_body',
  'robots_extra',
  'seo_indexable',
]);

/** Escape text for safe inclusion in HTML email bodies. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
