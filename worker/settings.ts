import type { Env } from './types';

const SECRET_KEYS = new Set(['turnstile_secret_key', 'resend_api_key']);

/** Keys exposed on the public marketing site (safe to show). */
export const PUBLIC_SITE_KEYS = [
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
  'seo_indexable',
  'yearly_price_usd',
  'free_trial_days',
] as const;

export type PublicSiteKey = (typeof PUBLIC_SITE_KEYS)[number];

const SITE_DEFAULTS: Record<string, string> = {
  site_name: 'WWebConsole',
  site_tagline: 'WeatherLink console for the web',
  site_description:
    'WWebConsole is a cloud weather console for Davis WeatherLink stations. Live dashboard, TV share links, and secure WeatherLink API credentials — free to start.',
  site_keywords:
    'WeatherLink, Davis Instruments, weather console, weather dashboard, WeatherLink Live, TV weather display, weather station',
  site_og_image: 'https://wwebconsole.com/og.png',
  site_canonical_base: 'https://wwebconsole.com',
  site_twitter_handle: '',
  site_support_email: 'support@wwebconsole.com',
  site_company_name: 'APEXs Inc',
  site_footer_text: 'Built for Davis WeatherLink stations. Cloud console on Cloudflare.',
  seo_home_title: 'WWebConsole — WeatherLink console for the web',
  seo_home_description:
    'Live WeatherLink dashboard, TV share links, and secure cloud credentials. Start free for 30 days.',
  seo_features_title: 'Features — WWebConsole',
  seo_features_description:
    'Live weather dashboard, WeatherLink v1/v2 API, TV share URLs, account security, and admin controls.',
  seo_pricing_title: 'Pricing — WWebConsole',
  seo_pricing_description:
    'Free trial, then yearly per-device pricing for WeatherLink Pro stations. Cancel anytime.',
  seo_about_title: 'About — WWebConsole',
  seo_about_description:
    'Why we built WWebConsole: a modern web console for Davis WeatherLink without local servers.',
  seo_contact_title: 'Contact — WWebConsole',
  seo_contact_description:
    'Get in touch with the WWebConsole team for support, billing, or partnership questions.',
  seo_privacy_title: 'Privacy Policy — WWebConsole',
  seo_privacy_description:
    'How WWebConsole collects, stores, and protects your account and WeatherLink data.',
  seo_terms_title: 'Terms of Service — WWebConsole',
  seo_terms_description: 'Terms governing use of WWebConsole, billing, and WeatherLink integrations.',
  seo_changelog_title: 'Changelog — WWebConsole',
  seo_changelog_description: 'Product updates and release notes for WWebConsole.',
  home_hero_headline: 'Your WeatherLink station, on the web',
  home_hero_subhead:
    'Secure cloud console for Davis WeatherLink. Live dashboard, TV share links, and admin-ready accounts — start free.',
  home_hero_cta_primary: 'Start free',
  home_hero_cta_secondary: 'See pricing',
  home_features_json: JSON.stringify([
    {
      title: 'Live dashboard',
      body: 'Temperature, wind, rain, pressure, and sun times from your WeatherLink station.',
    },
    {
      title: 'TV share links',
      body: 'Fullscreen public URLs for lobbies, offices, and wall displays.',
    },
    {
      title: 'Secure credentials',
      body: 'WeatherLink API keys encrypted at rest. Choose v1 or v2 — never both.',
    },
    {
      title: 'Cloud-native',
      body: 'Runs on Cloudflare Workers worldwide. No local server to babysit.',
    },
  ]),
  pricing_headline: 'Simple yearly pricing',
  pricing_subhead: 'Try free, then pay per device when you need continuous Pro polling.',
  pricing_basic_blurb:
    'Free trial access with Basic WeatherLink polling (about every 15 minutes). Perfect to evaluate the console.',
  pricing_pro_blurb:
    'Yearly per device for WeatherLink Pro stations. Faster polling and continuous access after the trial.',
  pricing_footnote:
    'Paid plans require a WeatherLink Pro subscription from Davis. Activate devices from your account or ask an admin.',
  about_body:
    'WWebConsole is a cloud weather console for Davis WeatherLink stations. We built it so you can monitor stations from any browser, share a TV display URL, and keep API credentials encrypted — without running a local server.\n\nThe product runs on Cloudflare Workers and D1, with optional Turnstile bot protection and email verification.',
  contact_intro:
    'Questions about billing, WeatherLink setup, or enterprise access? Email us and we will get back to you.',
  privacy_body:
    '## Overview\nWWebConsole (“we”, “us”) provides a web console for Davis WeatherLink stations. This policy explains what we collect and why.\n\n## Account data\nWe store your email, optional name, password hash, and account status. If email verification is enabled, we temporarily store one-time codes.\n\n## WeatherLink credentials\nAPI keys and secrets you enter are encrypted at rest and used only to fetch weather data for your account. We do not sell credential data.\n\n## Usage data\nWe store station configuration, cached weather payloads, share-link slugs, and billing/trial timestamps needed to operate the service.\n\n## Cookies\nWe use a session cookie to keep you signed in. Theme preference may be stored in local browser storage.\n\n## Retention & deletion\nYou can schedule account deletion from Account settings. After the grace period, account data is purged. Contact support for earlier assistance.\n\n## Contact\nEmail the address shown on the Contact page for privacy requests.',
  terms_body:
    '## Agreement\nBy using WWebConsole you agree to these terms.\n\n## Service\nWe provide a best-effort cloud console for WeatherLink data. WeatherLink and Davis Instruments are third parties; their APIs and plans are outside our control.\n\n## Accounts\nYou are responsible for safeguarding your password and for activity under your account. Do not share credentials that you are not authorized to use.\n\n## Billing\nFree trial length and yearly pricing are shown on the Pricing page and may change. Paid device access may require WeatherLink Pro. Refunds are handled case-by-case.\n\n## Acceptable use\nDo not abuse the service, attempt unauthorized access, or use share links for unlawful content.\n\n## Disclaimer\nThe service is provided “as is” without warranties. We are not liable for weather data accuracy, API outages, or consequential damages to the extent permitted by law.\n\n## Changes\nWe may update these terms; continued use after changes constitutes acceptance.\n\n## Contact\nUse the Contact page for legal or billing questions.',
  changelog_body:
    '## 2026-07-09\n- Marketing site and SEO pages\n- Admin-configurable site & SEO settings\n- Account email/password change and 15-day deletion grace\n- Light theme default with dark mode\n- WeatherLink v1 or v2 credentials (exclusive)\n\n## Earlier\n- Cloudflare Workers + D1 rewrite\n- Auth, Turnstile, Resend OTP\n- Free trial and yearly per-device Pro\n- TV share links and admin console',
  seo_indexable: '1',
  yearly_price_usd: '49',
  free_trial_days: '30',
};

/** Admin UI groups for Site & SEO editor */
export const SITE_SETTING_GROUPS: { id: string; label: string; keys: string[] }[] = [
  {
    id: 'brand',
    label: 'Brand & contact',
    keys: [
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
      'seo_indexable',
      'robots_extra',
    ],
  },
  {
    id: 'home',
    label: 'Home page',
    keys: [
      'seo_home_title',
      'seo_home_description',
      'home_hero_headline',
      'home_hero_subhead',
      'home_hero_cta_primary',
      'home_hero_cta_secondary',
      'home_features_json',
    ],
  },
  {
    id: 'pricing',
    label: 'Pricing page',
    keys: [
      'seo_pricing_title',
      'seo_pricing_description',
      'pricing_headline',
      'pricing_subhead',
      'pricing_basic_blurb',
      'pricing_pro_blurb',
      'pricing_footnote',
      'yearly_price_usd',
      'free_trial_days',
    ],
  },
  {
    id: 'pages',
    label: 'Features / About / Contact SEO',
    keys: [
      'seo_features_title',
      'seo_features_description',
      'seo_about_title',
      'seo_about_description',
      'about_body',
      'seo_contact_title',
      'seo_contact_description',
      'contact_intro',
    ],
  },
  {
    id: 'legal',
    label: 'Legal & changelog',
    keys: [
      'seo_privacy_title',
      'seo_privacy_description',
      'privacy_body',
      'seo_terms_title',
      'seo_terms_description',
      'terms_body',
      'seo_changelog_title',
      'seo_changelog_description',
      'changelog_body',
    ],
  },
];

const INTEGRATION_KEYS = new Set([
  'turnstile_site_key',
  'turnstile_secret_key',
  'turnstile_enabled',
  'resend_api_key',
  'resend_from_email',
  'resend_enabled',
  'poll_basic_sec',
  'poll_pro_sec',
]);

export async function getSetting(env: Env, key: string): Promise<string> {
  // Workers secrets take precedence for sensitive keys
  if (key === 'turnstile_secret_key' && env.TURNSTILE_SECRET_KEY) return env.TURNSTILE_SECRET_KEY;
  if (key === 'resend_api_key' && env.RESEND_API_KEY) return env.RESEND_API_KEY;

  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind(key).first<{ value: string }>();
  if (row?.value != null && row.value !== '') return row.value;
  return SITE_DEFAULTS[key] ?? '';
}

export async function getSettingsMap(env: Env, keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of keys) out[key] = await getSetting(env, key);
  return out;
}

export async function setSetting(env: Env, key: string, value: string) {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(key, value, now)
    .run();
}

export async function ensureSiteSettingsSeeded(env: Env) {
  for (const [key, value] of Object.entries(SITE_DEFAULTS)) {
    const existing = await env.DB.prepare('SELECT key FROM app_settings WHERE key = ?').bind(key).first();
    if (!existing) await setSetting(env, key, value);
  }
}

export async function listSettingsForAdmin(env: Env) {
  await ensureSiteSettingsSeeded(env);
  const { results } = await env.DB.prepare('SELECT key, value, updated_at FROM app_settings ORDER BY key').all<{
    key: string;
    value: string;
    updated_at: number;
  }>();

  return (results || []).map((r) => ({
    key: r.key,
    value: SECRET_KEYS.has(r.key) ? (r.value ? '••••••••' : '') : r.value,
    hasValue:
      Boolean(r.value) ||
      (r.key === 'turnstile_secret_key' && Boolean(env.TURNSTILE_SECRET_KEY)) ||
      (r.key === 'resend_api_key' && Boolean(env.RESEND_API_KEY)),
    secret: SECRET_KEYS.has(r.key),
    updated_at: r.updated_at,
    group: INTEGRATION_KEYS.has(r.key)
      ? 'integrations'
      : SITE_SETTING_GROUPS.find((g) => g.keys.includes(r.key))?.id || 'other',
  }));
}

export async function isEnabled(env: Env, flagKey: string): Promise<boolean> {
  const v = await getSetting(env, flagKey);
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

export async function getPublicAuthConfig(env: Env) {
  const [turnstileEnabled, siteKey, resendEnabled, yearlyPrice, freeDays] = await Promise.all([
    isEnabled(env, 'turnstile_enabled'),
    getSetting(env, 'turnstile_site_key'),
    isEnabled(env, 'resend_enabled'),
    getSetting(env, 'yearly_price_usd'),
    getSetting(env, 'free_trial_days'),
  ]);
  return {
    turnstileEnabled: turnstileEnabled && Boolean(siteKey),
    turnstileSiteKey: turnstileEnabled ? siteKey : '',
    emailVerificationRequired: resendEnabled,
    yearlyPriceUsd: Number(yearlyPrice) || 49,
    freeTrialDays: Number(freeDays) || 30,
  };
}

export type PublicSiteConfig = Record<string, string> & {
  yearlyPriceUsd: number;
  freeTrialDays: number;
  indexable: boolean;
  features: { title: string; body: string }[];
};

export async function getPublicSiteConfig(env: Env): Promise<PublicSiteConfig> {
  const map = await getSettingsMap(env, [...PUBLIC_SITE_KEYS]);
  let features: { title: string; body: string }[] = [];
  try {
    const parsed = JSON.parse(map.home_features_json || '[]');
    if (Array.isArray(parsed)) {
      features = parsed
        .filter((x) => x && typeof x.title === 'string' && typeof x.body === 'string')
        .map((x) => ({ title: x.title, body: x.body }));
    }
  } catch {
    features = [];
  }

  return {
    ...map,
    yearlyPriceUsd: Number(map.yearly_price_usd) || 49,
    freeTrialDays: Number(map.free_trial_days) || 30,
    indexable: map.seo_indexable === '1' || map.seo_indexable?.toLowerCase() === 'true',
    features,
  };
}

export type SeoPageId = 'home' | 'features' | 'pricing' | 'about' | 'contact' | 'privacy' | 'terms' | 'changelog';

const SEO_PATHS: Record<string, SeoPageId> = {
  '/': 'home',
  '/features': 'features',
  '/pricing': 'pricing',
  '/about': 'about',
  '/contact': 'contact',
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/changelog': 'changelog',
};

export function seoPageFromPath(pathname: string): SeoPageId | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return SEO_PATHS[clean] ?? null;
}

export async function getSeoForPath(env: Env, pathname: string) {
  const page = seoPageFromPath(pathname);
  if (!page) return null;
  const site = await getPublicSiteConfig(env);
  const titleKey = page === 'home' ? 'seo_home_title' : `seo_${page}_title`;
  const descKey = page === 'home' ? 'seo_home_description' : `seo_${page}_description`;
  const title = site[titleKey] || site.site_name || 'WWebConsole';
  const description = site[descKey] || site.site_description || '';
  const base = (site.site_canonical_base || 'https://wwebconsole.com').replace(/\/+$/, '');
  const path = pathname.replace(/\/+$/, '') || '/';
  const canonical = path === '/' ? `${base}/` : `${base}${path}`;
  return {
    title,
    description,
    keywords: site.site_keywords || '',
    ogImage: site.site_og_image || '',
    canonical,
    twitter: site.site_twitter_handle || '',
    indexable: site.indexable,
    siteName: site.site_name || 'WWebConsole',
  };
}

export async function buildRobotsTxt(env: Env): Promise<string> {
  const site = await getPublicSiteConfig(env);
  const base = (site.site_canonical_base || 'https://wwebconsole.com').replace(/\/+$/, '');
  const extra = await getSetting(env, 'robots_extra');
  if (!site.indexable) {
    return `User-agent: *\nDisallow: /\n`;
  }
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /app',
    'Disallow: /account',
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    extra ? `\n${extra.trim()}` : '',
  ]
    .filter((l) => l !== undefined)
    .join('\n')
    .trim() + '\n';
}

export async function buildSitemapXml(env: Env): Promise<string> {
  const site = await getPublicSiteConfig(env);
  const base = (site.site_canonical_base || 'https://wwebconsole.com').replace(/\/+$/, '');
  if (!site.indexable) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;
  }
  const paths = ['/', '/features', '/pricing', '/about', '/contact', '/privacy', '/terms', '/changelog'];
  const urls = paths
    .map((p) => {
      const loc = p === '/' ? `${base}/` : `${base}${p}`;
      return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

/** Inject title/meta into SPA HTML for crawlers on marketing routes. */
export function injectSeoIntoHtml(html: string, seo: Awaited<ReturnType<typeof getSeoForPath>>): string {
  if (!seo) return html;
  const robots = seo.indexable ? 'index,follow' : 'noindex,nofollow';
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const meta = [
    `<title>${escape(seo.title)}</title>`,
    `<meta name="description" content="${escape(seo.description)}" />`,
    seo.keywords ? `<meta name="keywords" content="${escape(seo.keywords)}" />` : '',
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${escape(seo.canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escape(seo.siteName)}" />`,
    `<meta property="og:title" content="${escape(seo.title)}" />`,
    `<meta property="og:description" content="${escape(seo.description)}" />`,
    `<meta property="og:url" content="${escape(seo.canonical)}" />`,
    seo.ogImage ? `<meta property="og:image" content="${escape(seo.ogImage)}" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escape(seo.title)}" />`,
    `<meta name="twitter:description" content="${escape(seo.description)}" />`,
    seo.twitter ? `<meta name="twitter:site" content="${escape(seo.twitter)}" />` : '',
    seo.ogImage ? `<meta name="twitter:image" content="${escape(seo.ogImage)}" />` : '',
  ]
    .filter(Boolean)
    .join('\n    ');

  let out = html
    .replace(/<title>[^<]*<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/gi, '')
    .replace(/<meta\s+name="keywords"[^>]*>/gi, '')
    .replace(/<meta\s+name="robots"[^>]*>/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, '');

  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `    ${meta}\n  </head>`);
  } else {
    out = `${meta}\n${out}`;
  }
  return out;
}
