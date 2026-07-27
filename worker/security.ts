import type { Context, Next } from 'hono';
import type { Env } from './types';
import { rateLimit, RATE_LIMITS } from './rateLimit';

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
  const isApi = path.startsWith('/api/');
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (isApi) {
    c.res.headers.set('Cache-Control', 'no-store');
    c.res.headers.set(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    );
  }
}

/** CSP for HTML document responses (SPA). Allows Vite assets + Turnstile. */
export const SPA_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
].join('; ');

export function withSpaSecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Content-Security-Policy', SPA_CONTENT_SECURITY_POLICY);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function limitJsonBody(c: Context<{ Bindings: Env }>, next: Next) {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
    return next();
  }
  const cl = c.req.header('content-length');
  if (cl && Number(cl) > MAX_JSON_BYTES) {
    return c.json({ error: 'Request body too large' }, 413);
  }
  return next();
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

export function isDevEnvironment(env: Env, requestUrl: string): boolean {
  if ((env as any).ENVIRONMENT === 'development' || (env as any).ALLOW_DEV_OTP === '1') return true;
  try {
    const host = new URL(requestUrl).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
  } catch {
    return false;
  }
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
