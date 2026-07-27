import type { Env } from './types';
import { localizeYearlyPrice } from './pricing';

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
  'seo_indexable',
  'yearly_price_usd',
  'free_trial_days',
] as const;

export type PublicSiteKey = (typeof PUBLIC_SITE_KEYS)[number];

const SITE_DEFAULTS: Record<string, string> = {
  site_name: 'Weatherlink Web Console',
  site_tagline: 'Your station console, on the web',
  site_description:
    'Weatherlink Web Console is an independent web console for Davis WeatherLink® stations. Live dashboard, TV share links, and private credentials — free to start. Not affiliated with Davis Instruments.',
  site_keywords:
    'WeatherLink, weather console, weather dashboard, weather station display, TV weather display',
  site_og_image: 'https://wwebconsole.com/og.png',
  site_canonical_base: 'https://wwebconsole.com',
  site_twitter_handle: '',
  site_support_email: 'support@wwebconsole.com',
  site_company_name: 'APEXs Inc',
  site_footer_text: 'Independent web console for WeatherLink® stations.',
  site_trademark_note:
    'WeatherLink® and Davis® are registered trademarks of Davis Instruments Corp. Weatherlink Web Console is an independent product and is not affiliated with, endorsed by, or connected to Davis Instruments or WeatherLink.',
  seo_home_title: 'Weatherlink Web Console — station console for the web',
  seo_home_description: 'Live station dashboard and TV share links. Start free. Independent of Davis Instruments.',
  seo_features_title: 'Features — Weatherlink Web Console',
  seo_features_description: 'Live weather dashboard, station connection, TV share URLs, and account tools.',
  seo_pricing_title: 'Pricing — Weatherlink Web Console',
  seo_pricing_description: 'Free trial, then yearly per-device pricing for Pro stations.',
  seo_about_title: 'About — Weatherlink Web Console',
  seo_about_description: 'An independent web console for WeatherLink® stations. Not affiliated with Davis Instruments.',
  seo_contact_title: 'Contact — Weatherlink Web Console',
  seo_contact_description: 'Contact us for support or billing questions.',
  seo_privacy_title: 'Privacy Policy — Weatherlink Web Console',
  seo_privacy_description: 'How we handle account and station-related information.',
  seo_terms_title: 'Terms of Service — Weatherlink Web Console',
  seo_terms_description: 'Terms for using Weatherlink Web Console and related billing.',
  seo_changelog_title: 'Changelog — Weatherlink Web Console',
  seo_changelog_description: 'Product updates for Weatherlink Web Console.',
  home_hero_headline: 'Your station console, on the web',
  home_hero_subhead:
    'Live dashboard and TV share links for your WeatherLink® station — start free. Independent product, not affiliated with Davis Instruments.',
  home_hero_cta_primary: 'Start free',
  home_hero_cta_secondary: 'See pricing',
  home_features_json: JSON.stringify([
    {
      title: 'Live dashboard',
      body: 'Temperature, wind, rain, pressure, and sun times from your station.',
    },
    {
      title: 'TV share links',
      body: 'Fullscreen public URLs for lobbies, offices, and wall displays.',
    },
    {
      title: 'Secure credentials',
      body: 'Connect with your WeatherLink® API credentials. Your keys stay private to your account.',
    },
    {
      title: 'Works in the browser',
      body: 'Open your console from any device — no software to install on site.',
    },
  ]),
  pricing_headline: 'Simple yearly pricing',
  pricing_subhead: 'Try free, then pay per device when you need continuous Pro updates.',
  pricing_basic_blurb:
    'Free trial access with Basic WeatherLink® update rates. Perfect to evaluate the console.',
  pricing_pro_blurb:
    'Yearly per device for WeatherLink® Pro stations. Faster updates and continuous access after the trial.',
  pricing_footnote:
    'Paid plans may require a WeatherLink® Pro subscription from Davis Instruments. Contact support if you need help activating a device. We are not affiliated with Davis Instruments.',
  about_body:
    'Weatherlink Web Console is an independent web console for Davis WeatherLink® stations. Monitor your station from any browser, share a display link for TVs and lobbies, and keep your credentials private to your account.\n\nWe are not affiliated with, endorsed by, or connected to Davis Instruments Corp. or WeatherLink. WeatherLink® and Davis® are registered trademarks of Davis Instruments Corp.\n\nWe focus on a simple, reliable console — not on running software at your site.',
  contact_intro:
    'Questions about billing, setup, or access? Email us and we will get back to you.',
  privacy_body:
    '## Overview\nWeatherlink Web Console (“we”, “us”) provides an independent web console for Davis WeatherLink® stations. This policy explains what we collect and why. We are not affiliated with Davis Instruments.\n\n## Account data\nWe store the information needed to run your account, such as email, optional name, and account status. Verification codes may be stored briefly when email confirmation is required.\n\n## Station credentials\nCredentials you enter are used only to fetch weather data for your account. We do not sell your data.\n\n## Service data\nWe store station settings, display preferences, share links you create, and billing or trial information needed to provide the service.\n\n## Cookies\nWe use a sign-in cookie to keep you logged in. Theme preference may be stored in your browser.\n\n## Retention & deletion\nYou can request account deletion from Account settings. After a short grace period, account data is removed. Contact support if you need help sooner.\n\n## Contact\nEmail the address on the Contact page for privacy requests.',
  terms_body:
    '## Agreement\nBy using Weatherlink Web Console you agree to these terms.\n\n## Service\nWe provide a best-effort independent web console for WeatherLink® data. WeatherLink® and Davis Instruments are separate products; their availability and plans are outside our control. We are not affiliated with, endorsed by, or connected to Davis Instruments Corp.\n\n## Accounts\nYou are responsible for your password and for activity under your account. Do not use credentials you are not authorized to use.\n\n## Billing\nFree trial length and yearly pricing are shown on the Pricing page and may change. Paid device access may require WeatherLink® Pro. Refunds are handled case-by-case.\n\n## Acceptable use\nDo not abuse the service, attempt unauthorized access, or use share links for unlawful content.\n\n## Trademarks\nWeatherLink® and Davis® are registered trademarks of Davis Instruments Corp. Use of those names is for identification only.\n\n## Disclaimer\nThe service is provided “as is” without warranties. We are not liable for weather data accuracy, third-party outages, or consequential damages to the extent permitted by law.\n\n## Changes\nWe may update these terms; continued use after changes constitutes acceptance.\n\n## Contact\nUse the Contact page for legal or billing questions.',
  changelog_body:
    '## [1.5.2]\n- Branding updated to Weatherlink Web Console\n- Clearer trademark disclaimer in the footer\n- Darker homepage hero for easier reading\n\n## [1.5.1]\n- Homepage showcases the live console with a full-screen product image\n- Clearer product story on Features\n\n## [1.5.0]\n- Prices show in your local currency based on where you visit from\n- Show or hide password on sign-in and account forms\n- Contact form on the website\n\n## [1.4.0]\n- Stronger account protection\n- Public website pages\n- Console at /app\n\n## [1.1.0]\n- Live station dashboard\n- TV share links\n- Account sign-in',
  seo_indexable: '1',
  yearly_price_usd: '39',
  free_trial_days: '60',
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
      'site_trademark_note',
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
    yearlyPriceUsd: Number(yearlyPrice) || 39,
    freeTrialDays: Number(freeDays) || 60,
  };
}

export type PublicSiteConfig = {
  [key: string]: any;
  yearlyPriceUsd: number;
  freeTrialDays: number;
  indexable: boolean;
  features: { title: string; body: string }[];
  pricing?: {
    currency: string;
    amount: number;
    formatted: string;
    periodLabel: string;
    note: string;
    country: string;
  };
};

export async function getPublicSiteConfig(
  env: Env,
  country?: string | null
): Promise<PublicSiteConfig> {
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

  const yearlyPriceUsd = Number(map.yearly_price_usd) || 39;
  const localized = localizeYearlyPrice(yearlyPriceUsd, country);

  return {
    ...map,
    yearlyPriceUsd,
    freeTrialDays: Number(map.free_trial_days) || 60,
    indexable: map.seo_indexable === '1' || map.seo_indexable?.toLowerCase() === 'true',
    features,
    pricing: {
      currency: localized.currency,
      amount: localized.amount,
      formatted: localized.formatted,
      periodLabel: localized.periodLabel,
      note: localized.note,
      country: localized.country,
    },
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
