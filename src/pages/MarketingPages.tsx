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
      {/* Professional SaaS Hero */}
      <section className="relative pt-24 sm:pt-32 pb-20 overflow-hidden bg-[#020b18]">
        {/* Deep, complex gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#073075]/60 via-[#041a45] to-[#020b18]" />
        
        {/* Animated ambient mesh orbs */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-40 -left-40 w-[800px] h-[800px] bg-sky-500/20 blur-[120px] rounded-full pointer-events-none" 
        />
        <motion.div 
          animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-20 -right-20 w-[600px] h-[600px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" 
        />

        {/* Professional developer grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at center, white 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        
        {/* Subtle radial fade for text legibility */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/[0.03] via-transparent to-transparent opacity-60 pointer-events-none" />

        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 text-center flex flex-col items-center">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center w-full max-w-4xl"
          >
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 p-1.5 shadow-lg">
                <img src="/apexs-logo.png" alt="APEXS Logo" className="w-full h-full object-contain" />
              </div>
              <p className="font-[family-name:var(--font-display)] text-xl sm:text-2xl font-bold tracking-widest uppercase text-white drop-shadow-md">
                {brand}
              </p>
            </div>
            
            <motion.h1 
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-4xl font-[family-name:var(--font-display)] text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-sky-100 leading-[1.05] drop-shadow-lg pb-2"
            >
              {site?.home_hero_headline || 'Your station console, on the web'}
            </motion.h1>
            <motion.p 
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 max-w-2xl text-lg sm:text-xl text-sky-100/90 leading-relaxed font-medium drop-shadow-md"
            >
              Live dashboard and TV share links for your WeatherLink® station — start free.
            </motion.p>
            <div className="mt-10 mb-16 flex flex-wrap justify-center gap-4">
              <Link
                to="/register"
                className="inline-flex items-center justify-center px-10 py-4 rounded-xl bg-white text-[#073075] text-sm font-black hover:bg-sky-50 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] hover:-translate-y-1 hover:scale-[1.02] ring-1 ring-white/50"
              >
                {site?.home_hero_cta_primary || 'Start free'}
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center px-10 py-4 rounded-xl border border-white/20 bg-white/5 text-white text-sm font-bold backdrop-blur-xl hover:bg-white/10 transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.3)] hover:-translate-y-1 hover:scale-[1.02]"
              >
                {site?.home_hero_cta_secondary || 'See pricing'}
              </Link>
            </div>
            
            {/* The Floating Dashboard Image */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="w-full relative mt-4 sm:mt-10"
            >
              <motion.div
                animate={reduceMotion ? false : { y: [0, -12, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="absolute -inset-4 bg-white/5 rounded-[2rem] blur-xl pointer-events-none" />
                <div className="relative rounded-2xl sm:rounded-3xl border border-white/20 bg-[#040a10]/80 p-2 sm:p-3 shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur-sm ring-1 ring-white/10">
                  <img
                    src={HERO_IMG}
                    alt="Weatherlink Web Console dashboard"
                    className="w-full h-auto rounded-xl sm:rounded-2xl shadow-inner border border-white/10"
                    width={1439}
                    height={1079}
                    fetchPriority="high"
                    decoding="async"
                  />
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Soft fade transition to the next section */}
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />
      </section>

      {/* Product in context — device shot */}
      <section className="bg-slate-50 border-b border-gray-200 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-sky-100/40 blur-[100px] rounded-full pointer-events-none translate-x-1/3 -translate-y-1/3" />
        
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-24 grid md:grid-cols-2 gap-10 md:gap-14 items-center relative z-10">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700 leading-tight pb-1">
              The console you know — in the browser
            </h2>
            <p className="mt-5 text-slate-600 text-base sm:text-lg leading-relaxed max-w-md font-medium">
              Temperature, wind, rain, pressure, and sun times in one clear view. Share a fullscreen link for TVs,
              lobbies, and wall displays.
            </p>
            <Link to="/features" className="inline-flex mt-8 text-sm font-bold text-[#073075] hover:text-[#0a3f99] group transition-colors">
              Explore features <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </motion.div>
          <motion.div
            className="relative"
            initial={reduceMotion ? false : { opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Ambient glow behind the device card */}
            <div className="absolute -inset-4 bg-[#073075]/5 rounded-[3rem] blur-2xl pointer-events-none" />
            <motion.div 
              whileHover={{ y: -8, scale: 1.01 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="bg-white/80 backdrop-blur-xl p-3 sm:p-4 rounded-3xl shadow-[0_20px_60px_rgba(7,48,117,0.08)] ring-1 ring-gray-200/50 border border-white relative z-10"
            >
              <img
                src={DEVICE_IMG}
                alt="Weather console display showing live station data"
                className="w-full h-auto drop-shadow-sm rounded-2xl border border-gray-100/50"
                width={882}
                height={634}
                loading="lazy"
                decoding="async"
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="bg-slate-50 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-24 relative z-10">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700 pb-1">Built for WeatherLink</h2>
            <p className="text-slate-600 text-lg mt-4 max-w-xl leading-relaxed font-medium">
              Everything you need to run a station console online — nothing to install on site.
            </p>
          </motion.div>
          <div className="mt-14 grid sm:grid-cols-2 gap-6 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[#073075]/[0.02] blur-[80px] pointer-events-none" />
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                whileHover={{ y: -4, scale: 1.01 }}
                transition={{ duration: 0.4, delay: reduceMotion ? 0 : i * 0.06 }}
                className="bg-white/80 backdrop-blur-lg p-8 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] ring-1 ring-gray-100 hover:shadow-[0_20px_40px_rgba(7,48,117,0.06)] hover:ring-sky-100 transition-all cursor-default"
              >
                <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center mb-5 ring-1 ring-sky-100">
                  {/* Decorative dot */}
                  <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#073075] to-sky-400" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg font-[family-name:var(--font-display)]">{f.title}</h3>
                <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed font-medium">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:py-24 bg-slate-50 relative overflow-hidden">
        <motion.div 
          initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-5xl mx-auto bg-gradient-to-br from-[#073075] to-[#041a45] rounded-[2.5rem] p-10 sm:p-14 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8 shadow-[0_20px_60px_rgba(7,48,117,0.2)] relative overflow-hidden ring-1 ring-black/5"
        >
          {/* Stunning glowing orbs inside the CTA card */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-sky-400/20 blur-[100px] pointer-events-none rounded-full translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-white/5 blur-[80px] pointer-events-none rounded-full -translate-x-1/2 translate-y-1/2" />
          
          <div className="relative z-10">
            <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-sky-100 pb-1">
              Free for {site?.freeTrialDays ?? 30} days
            </h2>
            <p className="text-lg text-sky-100/90 mt-3 font-medium max-w-md">
              Then {price.formatted}
              {price.periodLabel} for WeatherLink Pro. No hardware required.
            </p>
            {price.note ? <p className="text-xs text-sky-200/50 mt-3 font-medium uppercase tracking-wider">{price.note}</p> : null}
          </div>
          <Link
            to="/register"
            className="relative z-10 inline-flex shrink-0 self-start sm:self-auto px-10 py-4 rounded-2xl bg-white text-[#073075] text-base font-black hover:bg-sky-50 shadow-[0_10px_30px_rgba(0,0,0,0.15)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.25)] hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300"
          >
            Create account
          </Link>
        </motion.div>
      </section>
      
      {/* Small subtle extension so the page seamlessly meets the footer if there's no dark mode jump */}
      <div className="h-10 bg-slate-50" />
    </div>
  );
}

export function FeaturesPage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_features_title', 'seo_features_description', '/features', 'Features', '');
  const features = site?.features?.length ? site.features : FEATURE_FALLBACKS;

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] pb-24">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl font-black text-slate-900 tracking-tight">Features</h1>
            <p className="text-slate-600 mt-6 max-w-md text-lg leading-relaxed font-medium">
              {site?.seo_features_description || 'Everything you need to monitor and share your live weather data.'}
            </p>
          </div>
          <div className="bg-slate-50 p-3 sm:p-4 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] ring-1 ring-gray-200">
            <img
              src={HERO_IMG}
              alt="Live weather console dashboard"
              className="w-full h-auto rounded-xl shadow-sm border border-gray-100/50"
              width={1439}
              height={1079}
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-20">
        <div className="grid gap-8 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="bg-white p-10 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] ring-1 ring-gray-100 hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all">
              <h2 className="font-bold text-2xl text-slate-900 font-[family-name:var(--font-display)]">{f.title}</h2>
              <p className="text-base sm:text-lg text-slate-600 mt-3 leading-relaxed font-medium">{f.body}</p>
            </div>
          ))}
          <div className="bg-white p-10 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] ring-1 ring-gray-100 hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all">
            <h2 className="font-bold text-2xl text-slate-900 font-[family-name:var(--font-display)]">Account security</h2>
            <p className="text-base sm:text-lg text-slate-600 mt-3 leading-relaxed font-medium">
              Sign-in protection, email verification when enabled, password and email change, and account deletion with
              a short grace period.
            </p>
          </div>
          <div className="bg-white p-10 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] ring-1 ring-gray-100 hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all">
            <h2 className="font-bold text-2xl text-slate-900 font-[family-name:var(--font-display)]">Simple setup</h2>
            <p className="text-base sm:text-lg text-slate-600 mt-3 leading-relaxed font-medium">
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
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] pb-24">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-24 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl font-black text-slate-900 tracking-tight">
            {site?.pricing_headline || 'Pricing'}
          </h1>
          <p className="text-slate-600 mt-6 max-w-2xl mx-auto text-lg font-medium">{site?.pricing_subhead || ''}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-10">
          <div className="bg-white rounded-3xl p-10 sm:p-12 shadow-[0_4px_20px_rgba(0,0,0,0.03)] ring-1 ring-gray-200">
            <p className="text-xs uppercase tracking-widest font-black text-slate-400">Trial</p>
            <p className="mt-4 font-[family-name:var(--font-display)] text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
              {site?.freeTrialDays ?? 30} days free
            </p>
            <p className="text-base sm:text-lg text-slate-600 mt-6 leading-relaxed font-medium">{site?.pricing_basic_blurb || ''}</p>
            <Link to="/register" className="inline-flex mt-8 text-base font-bold text-[#073075] hover:underline">
              Start free →
            </Link>
          </div>
          <div className="bg-[#f0f4f8] rounded-3xl p-10 sm:p-12 shadow-[0_10px_30px_rgba(7,48,117,0.08)] ring-2 ring-[#073075] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-sky-200/40 blur-[60px] pointer-events-none rounded-full" />
            <p className="text-xs uppercase tracking-widest font-black text-[#073075] relative z-10">Pro device</p>
            <p className="mt-4 font-[family-name:var(--font-display)] text-4xl sm:text-5xl font-black text-slate-900 tracking-tight relative z-10">
              {price.formatted}
              <span className="text-lg sm:text-xl font-medium text-slate-500"> {price.periodLabel}</span>
            </p>
            {price.note ? <p className="text-xs text-slate-500 mt-3 font-semibold uppercase tracking-wider relative z-10">{price.note}</p> : null}
            <p className="text-base sm:text-lg text-slate-700 mt-6 leading-relaxed font-medium relative z-10">{site?.pricing_pro_blurb || ''}</p>
            <Link to="/contact" className="inline-flex mt-8 text-base font-bold text-[#073075] hover:underline relative z-10">
              Ask about activation →
            </Link>
          </div>
        </div>
        <p className="mt-12 text-sm text-slate-500 text-center mx-auto max-w-2xl leading-relaxed font-medium">{site?.pricing_footnote || ''}</p>
      </div>
    </div>
  );
}

export function AboutPage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_about_title', 'seo_about_description', '/about', 'About', '');
  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] pb-24">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl font-black text-slate-900 tracking-tight">About</h1>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-white p-10 sm:p-14 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.04)] ring-1 ring-gray-200 text-lg sm:text-xl text-slate-700 leading-relaxed font-medium">
          <MarkdownLite text={site?.about_body || ''} />
        </div>
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
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] pb-24">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl font-black text-slate-900 tracking-tight">Contact</h1>
          <p className="text-slate-600 mt-6 text-lg leading-relaxed font-medium">{site?.contact_intro || ''}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-16">
        {sent ? (
          <div className="rounded-3xl bg-white shadow-[0_10px_40px_rgba(0,0,0,0.04)] ring-1 ring-gray-200 p-10 sm:p-14 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-green-100">
              <div className="w-4 h-4 bg-green-500 rounded-full" />
            </div>
            <p className="font-[family-name:var(--font-display)] font-black text-slate-900 text-3xl">Message received</p>
            <p className="text-lg text-slate-600 mt-4 font-medium leading-relaxed">
              Thanks — we will get back to you at <span className="text-slate-900 font-bold">{email}</span>. You can also reach us at{' '}
              <a href={`mailto:${supportEmail}`} className="text-[#073075] hover:underline font-bold">
                {supportEmail}
              </a>.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="relative bg-white p-8 sm:p-12 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.04)] ring-1 ring-gray-200 space-y-6">
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-5 py-4">
                <p className="text-rose-700 text-sm font-bold">{error}</p>
              </div>
            )}
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 font-black ml-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full bg-slate-50/50 border border-gray-200 rounded-xl px-5 py-3.5 text-base outline-none focus:border-[#073075] focus:ring-2 focus:ring-[#073075]/20 transition-all text-slate-900 font-medium"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 font-black ml-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full bg-slate-50/50 border border-gray-200 rounded-xl px-5 py-3.5 text-base outline-none focus:border-[#073075] focus:ring-2 focus:ring-[#073075]/20 transition-all text-slate-900 font-medium"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 font-black ml-1">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Billing, setup, partnership…"
                className="mt-2 w-full bg-slate-50/50 border border-gray-200 rounded-xl px-5 py-3.5 text-base outline-none focus:border-[#073075] focus:ring-2 focus:ring-[#073075]/20 transition-all text-slate-900 font-medium placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 font-black ml-1">Message</label>
              <textarea
                required
                minLength={10}
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-2 w-full bg-slate-50/50 border border-gray-200 rounded-xl px-5 py-3.5 text-base outline-none focus:border-[#073075] focus:ring-2 focus:ring-[#073075]/20 transition-all text-slate-900 font-medium resize-y"
              />
            </div>
            <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>
            {authCfg.turnstileEnabled && <div ref={hostRef} className="pt-2" />}
            <button
              type="submit"
              disabled={loading || (authCfg.turnstileEnabled && !turnstileToken)}
              className="w-full inline-flex justify-center items-center px-8 py-4 rounded-xl bg-[#073075] text-white text-base font-black hover:bg-[#0a3f99] transition-all shadow-[0_10px_30px_rgba(7,48,117,0.3)] hover:shadow-[0_15px_40px_rgba(7,48,117,0.4)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 mt-4"
            >
              {loading ? 'Sending…' : 'Send message'}
            </button>
            <p className="text-sm text-slate-500 font-medium text-center mt-6">
              Prefer email?{' '}
              <a href={`mailto:${supportEmail}`} className="text-[#073075] font-bold hover:underline">
                {supportEmail}
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export function PrivacyPage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_privacy_title', 'seo_privacy_description', '/privacy', 'Privacy', '');
  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] pb-14">
      <div className="max-w-3xl mx-auto px-4 py-14">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-slate-900">Privacy Policy</h1>
        <div className="mt-8 bg-white p-8 sm:p-10 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] ring-1 ring-gray-100">
          <MarkdownLite text={site?.privacy_body || ''} />
        </div>
      </div>
    </div>
  );
}

export function TermsPage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_terms_title', 'seo_terms_description', '/terms', 'Terms', '');
  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] pb-14">
      <div className="max-w-3xl mx-auto px-4 py-14">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-slate-900">Terms of Service</h1>
        <div className="mt-8 bg-white p-8 sm:p-10 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] ring-1 ring-gray-100">
          <MarkdownLite text={site?.terms_body || ''} />
        </div>
      </div>
    </div>
  );
}

export function ChangelogPage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_changelog_title', 'seo_changelog_description', '/changelog', 'Changelog', '');
  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] pb-14">
      <div className="max-w-3xl mx-auto px-4 py-14">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-slate-900">Changelog</h1>
        <div className="mt-8 bg-white p-8 sm:p-10 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] ring-1 ring-gray-100">
          <MarkdownLite text={site?.changelog_body || ''} />
        </div>
      </div>
    </div>
  );
}
