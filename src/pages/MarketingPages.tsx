import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import type { PublicSiteConfig } from '../services/api.js';
import { fetchAuthConfig, submitContact } from '../services/api.js';
import { applyDocumentSeo } from '../components/MarketingLayout.js';

const HERO_IMG = '/marketing/console-gallery.webp';
const DEVICE_IMG = '/marketing/console-device.png';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        }
      ) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
      ready?: (cb: () => void) => void;
    };
  }
}

type Ctx = { site: PublicSiteConfig | null };

const FEATURE_FALLBACKS = [
  { title: 'Live dashboard', body: 'Temperature, wind, rain, pressure, and sun times.' },
  { title: 'TV share links', body: 'Fullscreen public URLs for wall displays.' },
  { title: 'Secure credentials', body: 'Your WeatherLink credentials stay private to your account.' },
  { title: 'Works in the browser', body: 'Open your console from any device — nothing to install on site.' },
];

function MarkdownLite({ text }: { text: string }) {
  const lines = (text || '').split(/\n/);
  const nodes: ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (!list.length) return;
    nodes.push(
      <ul key={key} className="list-disc pl-5 space-y-1.5 text-sm text-[var(--wwc-muted)]">
        {list.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
    list = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(`ul-gap-${i}`);
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushList(`ul-before-h-${i}`);
      const heading = trimmed.slice(3).replace(/^\[|\]$/g, '').trim();
      nodes.push(
        <h2
          key={`h-${i}`}
          className="text-lg font-bold text-[var(--wwc-text)] font-[family-name:var(--font-display)] mt-8 mb-3 first:mt-0"
        >
          {heading}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith('- ')) {
      list.push(trimmed.slice(2));
      return;
    }
    flushList(`ul-before-p-${i}`);
    nodes.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed text-[var(--wwc-muted)] whitespace-pre-wrap">
        {trimmed}
      </p>
    );
  });
  flushList('ul-end');

  return <div className="prose-wwc space-y-3">{nodes}</div>;
}

function useLocalizedPrice(site: PublicSiteConfig | null) {
  const usd = site?.yearlyPriceUsd ?? 49;
  const p = site?.pricing;
  if (p?.formatted) {
    return {
      formatted: p.formatted,
      periodLabel: p.periodLabel || '/ year / device',
      note: p.note || '',
      usd,
    };
  }
  return {
    formatted: `$${usd}`,
    periodLabel: '/ year / device',
    note: '',
    usd,
  };
}

function usePageSeo(
  site: PublicSiteConfig | null,
  titleKey: string,
  descKey: string,
  path: string,
  fallbackTitle: string,
  fallbackDesc: string
) {
  useEffect(() => {
    if (!site) return;
    applyDocumentSeo({
      title: site[titleKey] || fallbackTitle,
      description: site[descKey] || fallbackDesc,
      canonicalBase: site.site_canonical_base,
      path,
      ogImage: site.site_og_image,
      keywords: site.site_keywords,
      indexable: site.indexable,
      siteName: site.site_name,
    });
  }, [site, titleKey, descKey, path, fallbackTitle, fallbackDesc]);
}

export function HomePage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_home_title', 'seo_home_description', '/', 'Weatherlink Web Console', '');
  const price = useLocalizedPrice(site);
  const reduceMotion = useReducedMotion();
  const features = site?.features?.length ? site.features : FEATURE_FALLBACKS;
  const brand = site?.site_name || 'Weatherlink Web Console';

  return (
    <div>
      {/* Full-bleed product hero */}
      <section className="relative min-h-[100svh] flex flex-col justify-end overflow-hidden bg-[#040a10]">
        <motion.div
          className="absolute inset-0"
          initial={reduceMotion ? false : { scale: 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            src={HERO_IMG}
            alt="Weatherlink Web Console live weather dashboard"
            className="h-full w-full object-cover object-[center_35%]"
            width={1439}
            height={1079}
            fetchPriority="high"
            decoding="async"
          />
        </motion.div>
        {/* Soft dark overlay for text readability without obscuring the image */}
        <div className="absolute inset-0 bg-black/40" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(4,10,16,0.3) 60%, rgba(4,10,16,0.9) 100%)',
          }}
        />

        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 pb-14 pt-28 sm:pb-24 sm:pt-32">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 p-1.5 shadow-lg">
                <img src="/apexs-logo.png" alt="APEXS Logo" className="w-full h-full object-contain" />
              </div>
              <p className="font-[family-name:var(--font-display)] text-xl sm:text-2xl font-bold tracking-widest uppercase text-white drop-shadow-md">
                {brand}
              </p>
            </div>
            
            <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-sky-200 leading-[1.05] drop-shadow-lg pb-2">
              {site?.home_hero_headline || 'Your station console, on the web'}
            </h1>
            <p className="mt-6 max-w-xl text-lg sm:text-xl text-sky-50 leading-relaxed font-medium drop-shadow-md">
              {site?.home_hero_subhead ||
                site?.site_tagline ||
                'Live dashboard and TV share links — open from any browser.'}
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/register"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-[#073075] text-white text-sm font-black hover:bg-[#0a3f99] transition-all shadow-[0_10px_30px_rgba(7,48,117,0.4)] hover:shadow-[0_10px_40px_rgba(7,48,117,0.6)] hover:scale-[1.02]"
              >
                {site?.home_hero_cta_primary || 'Start free'}
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl border border-white/30 bg-white/10 text-white text-sm font-bold backdrop-blur-md hover:bg-white/20 transition-all shadow-lg hover:scale-[1.02]"
              >
                {site?.home_hero_cta_secondary || 'See pricing'}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Product in context — device shot */}
      <section className="border-b border-[var(--wwc-border)] bg-[var(--wwc-page)]">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20 grid md:grid-cols-2 gap-10 md:gap-14 items-center">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-black tracking-tight text-[var(--wwc-text)] leading-tight">
              The console you know — in the browser
            </h2>
            <p className="mt-5 text-[var(--wwc-muted)] text-base sm:text-lg leading-relaxed max-w-md font-medium">
              Temperature, wind, rain, pressure, and sun times in one clear view. Share a fullscreen link for TVs,
              lobbies, and wall displays.
            </p>
            <Link to="/features" className="inline-flex mt-8 text-sm font-bold text-[#073075] dark:text-sky-400 hover:underline">
              Explore features →
            </Link>
          </motion.div>
          <motion.div
            className="relative"
            initial={reduceMotion ? false : { opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="absolute -inset-6 -z-10 rounded-full opacity-60 blur-3xl"
              style={{
                background: 'radial-gradient(circle at 50% 40%, rgba(7,48,117,0.35), transparent 65%)',
              }}
            />
            <img
              src={DEVICE_IMG}
              alt="Weather console display showing live station data"
              className="w-full h-auto drop-shadow-2xl"
              width={882}
              height={634}
              loading="lazy"
              decoding="async"
            />
          </motion.div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16 sm:py-24">
        <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-black text-[var(--wwc-text)]">Built for WeatherLink</h2>
        <p className="text-[var(--wwc-muted)] text-lg mt-4 max-w-xl leading-relaxed font-medium">
          Everything you need to run a station console online — nothing to install on site.
        </p>
        <div className="mt-14 grid sm:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: reduceMotion ? 0 : i * 0.06 }}
              className="bg-[var(--wwc-surface)] border border-[var(--wwc-border)] p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
            >
              <h3 className="font-bold text-[var(--wwc-text)] text-lg font-[family-name:var(--font-display)]">{f.title}</h3>
              <p className="text-base text-[var(--wwc-muted)] mt-3 leading-relaxed font-medium">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-4 py-16 sm:py-24 bg-[var(--wwc-page)]">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-[#073075] to-[#041a45] rounded-3xl p-10 sm:p-14 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8 shadow-2xl relative overflow-hidden">
          {/* Subtle glow in CTA */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-sky-400/20 blur-[100px] pointer-events-none rounded-full" />
          
          <div className="relative z-10">
            <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-black text-white">
              Free for {site?.freeTrialDays ?? 30} days
            </h2>
            <p className="text-base text-sky-100/90 mt-3 font-medium">
              Then {price.formatted}
              {price.periodLabel} for WeatherLink Pro.
            </p>
            {price.note ? <p className="text-xs text-sky-200/60 mt-2 font-medium">{price.note}</p> : null}
          </div>
          <Link
            to="/register"
            className="relative z-10 inline-flex shrink-0 self-start sm:self-auto px-8 py-4 rounded-xl bg-white text-[#073075] text-sm font-black hover:bg-sky-50 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
          >
            Create account
          </Link>
        </div>
      </section>
    </div>
  );
}

export function FeaturesPage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_features_title', 'seo_features_description', '/features', 'Features', '');
  const features = site?.features?.length ? site.features : FEATURE_FALLBACKS;

  return (
    <div>
      <div className="border-b border-[var(--wwc-border)] bg-[var(--wwc-surface)]">
        <div className="max-w-5xl mx-auto px-4 py-12 sm:py-14 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold">Features</h1>
            <p className="text-[var(--wwc-muted)] mt-4 max-w-md text-sm leading-relaxed">
              {site?.seo_features_description || 'What you get with Weatherlink Web Console.'}
            </p>
          </div>
          <img
            src={HERO_IMG}
            alt="Live weather console dashboard"
            className="w-full h-auto rounded-lg shadow-lg"
            width={1439}
            height={1079}
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="grid gap-10 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="border-t border-[var(--wwc-border)] pt-5">
              <h2 className="font-semibold text-lg">{f.title}</h2>
              <p className="text-sm text-[var(--wwc-muted)] mt-2 leading-relaxed">{f.body}</p>
            </div>
          ))}
          <div className="border-t border-[var(--wwc-border)] pt-5">
            <h2 className="font-semibold text-lg">Account security</h2>
            <p className="text-sm text-[var(--wwc-muted)] mt-2 leading-relaxed">
              Sign-in protection, email verification when enabled, password and email change, and account deletion with
              a short grace period.
            </p>
          </div>
          <div className="border-t border-[var(--wwc-border)] pt-5">
            <h2 className="font-semibold text-lg">Simple setup</h2>
            <p className="text-sm text-[var(--wwc-muted)] mt-2 leading-relaxed">
              Connect your WeatherLink station, open the live console, and share a TV display link when you need it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PricingPage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_pricing_title', 'seo_pricing_description', '/pricing', 'Pricing', '');
  const price = useLocalizedPrice(site);

  return (
    <div className="max-w-5xl mx-auto px-4 py-14">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        {site?.pricing_headline || 'Pricing'}
      </h1>
      <p className="text-[var(--wwc-muted)] mt-3 max-w-2xl text-sm">{site?.pricing_subhead || ''}</p>

      <div className="mt-12 grid md:grid-cols-2 gap-8">
        <div className="border border-[var(--wwc-border)] rounded-xl p-6 bg-[var(--wwc-surface)]">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--wwc-muted)]">Trial</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
            {site?.freeTrialDays ?? 30} days free
          </p>
          <p className="text-sm text-[var(--wwc-muted)] mt-4 leading-relaxed">{site?.pricing_basic_blurb || ''}</p>
          <Link to="/register" className="inline-flex mt-6 text-sm font-semibold text-[var(--wwc-accent)]">
            Start free →
          </Link>
        </div>
        <div className="border border-[var(--wwc-accent)]/40 rounded-xl p-6 bg-[var(--wwc-surface)]">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--wwc-accent)]">Pro device</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
            {price.formatted}
            <span className="text-base font-medium text-[var(--wwc-muted)]"> {price.periodLabel}</span>
          </p>
          {price.note ? <p className="text-[11px] text-[var(--wwc-muted)] mt-2">{price.note}</p> : null}
          <p className="text-sm text-[var(--wwc-muted)] mt-4 leading-relaxed">{site?.pricing_pro_blurb || ''}</p>
          <Link to="/contact" className="inline-flex mt-6 text-sm font-semibold text-[var(--wwc-accent)]">
            Ask about activation →
          </Link>
        </div>
      </div>
      <p className="mt-8 text-xs text-[var(--wwc-muted)] max-w-2xl leading-relaxed">{site?.pricing_footnote || ''}</p>
    </div>
  );
}

export function AboutPage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_about_title', 'seo_about_description', '/about', 'About', '');
  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">About</h1>
      <div className="mt-8">
        <MarkdownLite text={site?.about_body || ''} />
      </div>
    </div>
  );
}

export function ContactPage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_contact_title', 'seo_contact_description', '/contact', 'Contact', '');
  const supportEmail = site?.site_support_email || 'support@wwebconsole.com';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authCfg, setAuthCfg] = useState({ turnstileEnabled: false, turnstileSiteKey: '' });
  const [turnstileToken, setTurnstileToken] = useState('');
  const [widgetEpoch, setWidgetEpoch] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    fetchAuthConfig().then(setAuthCfg).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!authCfg.turnstileEnabled || !authCfg.turnstileSiteKey) return;
    let cancelled = false;

    const mount = () => {
      if (cancelled || !hostRef.current || !window.turnstile) return;
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
      hostRef.current.innerHTML = '';
      widgetIdRef.current = window.turnstile.render(hostRef.current, {
        sitekey: authCfg.turnstileSiteKey,
        theme: 'auto',
        callback: (t) => setTurnstileToken(t),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
      });
    };

    if (window.turnstile?.render) {
      mount();
    } else {
      const existing = document.querySelector('script[data-wwc-turnstile]');
      if (!existing) {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.dataset.wwcTurnstile = '1';
        s.onload = mount;
        document.head.appendChild(s);
      } else {
        let tries = 0;
        const id = window.setInterval(() => {
          if (window.turnstile?.render) {
            window.clearInterval(id);
            mount();
          } else if (++tries > 40) window.clearInterval(id);
        }, 100);
      }
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [authCfg.turnstileEnabled, authCfg.turnstileSiteKey, widgetEpoch]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (authCfg.turnstileEnabled && !turnstileToken) {
      setError('Complete the security check before sending.');
      return;
    }
    setLoading(true);
    try {
      await submitContact({
        name,
        email,
        subject,
        message,
        turnstileToken: turnstileToken || undefined,
        website,
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Could not send message');
      setTurnstileToken('');
      setWidgetEpoch((n) => n + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Contact</h1>
      <p className="text-[var(--wwc-muted)] mt-4 text-sm leading-relaxed">{site?.contact_intro || ''}</p>

      {sent ? (
        <div className="mt-10 rounded-xl border border-[var(--wwc-border)] bg-[var(--wwc-surface)] p-6">
          <p className="font-semibold text-[var(--wwc-text)]">Message received</p>
          <p className="text-sm text-[var(--wwc-muted)] mt-2">
            Thanks — we will get back to you at {email}. You can also reach us at{' '}
            <a href={`mailto:${supportEmail}`} className="text-[var(--wwc-accent)] hover:underline">
              {supportEmail}
            </a>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-10 space-y-4 max-w-xl relative">
          {error && (
            <p className="text-rose-600 dark:text-rose-400 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-[var(--wwc-muted)] font-bold">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full bg-[var(--wwc-surface)] border border-[var(--wwc-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--wwc-accent)]"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-[var(--wwc-muted)] font-bold">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full bg-[var(--wwc-surface)] border border-[var(--wwc-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--wwc-accent)]"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-[var(--wwc-muted)] font-bold">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Billing, setup, partnership…"
              className="mt-1 w-full bg-[var(--wwc-surface)] border border-[var(--wwc-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--wwc-accent)]"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-[var(--wwc-muted)] font-bold">Message</label>
            <textarea
              required
              minLength={10}
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full bg-[var(--wwc-surface)] border border-[var(--wwc-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--wwc-accent)] resize-y"
            />
          </div>
          <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>
          {authCfg.turnstileEnabled && <div ref={hostRef} className="pt-1" />}
          <button
            type="submit"
            disabled={loading || (authCfg.turnstileEnabled && !turnstileToken)}
            className="inline-flex px-5 py-2.5 rounded-md bg-[var(--wwc-accent)] text-white text-sm font-semibold disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send message'}
          </button>
          <p className="text-xs text-[var(--wwc-muted)]">
            Prefer email?{' '}
            <a href={`mailto:${supportEmail}`} className="text-[var(--wwc-accent)] hover:underline">
              {supportEmail}
            </a>
          </p>
        </form>
      )}
    </div>
  );
}

export function PrivacyPage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_privacy_title', 'seo_privacy_description', '/privacy', 'Privacy', '');
  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Privacy Policy</h1>
      <div className="mt-8">
        <MarkdownLite text={site?.privacy_body || ''} />
      </div>
    </div>
  );
}

export function TermsPage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_terms_title', 'seo_terms_description', '/terms', 'Terms', '');
  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Terms of Service</h1>
      <div className="mt-8">
        <MarkdownLite text={site?.terms_body || ''} />
      </div>
    </div>
  );
}

export function ChangelogPage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_changelog_title', 'seo_changelog_description', '/changelog', 'Changelog', '');
  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Changelog</h1>
      <div className="mt-8">
        <MarkdownLite text={site?.changelog_body || ''} />
      </div>
    </div>
  );
}
