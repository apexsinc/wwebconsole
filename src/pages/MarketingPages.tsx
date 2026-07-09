import { useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { PublicSiteConfig } from '../services/api.js';
import { applyDocumentSeo } from '../components/MarketingLayout.js';

type Ctx = { site: PublicSiteConfig | null };

function MarkdownLite({ text }: { text: string }) {
  const blocks = (text || '').split(/\n\n+/);
  return (
    <div className="prose-wwc space-y-4 text-sm leading-relaxed text-[var(--wwc-muted)]">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={i} className="text-lg font-bold text-[var(--wwc-text)] font-[family-name:var(--font-display)] mt-6 mb-2">
              {trimmed.slice(3)}
            </h2>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
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
  usePageSeo(site, 'seo_home_title', 'seo_home_description', '/', 'WWebConsole', '');

  const features = site?.features?.length
    ? site.features
    : [
        { title: 'Live dashboard', body: 'Temperature, wind, rain, pressure, and sun times.' },
        { title: 'TV share links', body: 'Fullscreen public URLs for wall displays.' },
        { title: 'Secure credentials', body: 'Your WeatherLink credentials stay private to your account.' },
        { title: 'Works in the browser', body: 'Open your console from any device — nothing to install on site.' },
      ];

  return (
    <div>
      <section className="relative overflow-hidden border-b border-[var(--wwc-border)]">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 70% 20%, rgba(2,132,199,0.18), transparent 55%), radial-gradient(ellipse 60% 50% at 10% 80%, rgba(14,165,233,0.12), transparent 50%), linear-gradient(180deg, var(--wwc-surface) 0%, var(--wwc-page) 100%)',
          }}
        />
        <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <p className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[var(--wwc-text)] max-w-3xl leading-[1.1]">
            {site?.site_name || 'WWebConsole'}
          </p>
          <h1 className="mt-5 text-xl sm:text-2xl font-medium text-[var(--wwc-text)] max-w-2xl leading-snug">
            {site?.home_hero_headline || 'Your WeatherLink station, on the web'}
          </h1>
          <p className="mt-4 text-[var(--wwc-muted)] max-w-xl text-base leading-relaxed">
            {site?.home_hero_subhead || site?.site_tagline || ''}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-[var(--wwc-accent)] text-white text-sm font-semibold hover:opacity-90"
            >
              {site?.home_hero_cta_primary || 'Start free'}
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-md border border-[var(--wwc-border)] bg-[var(--wwc-surface)] text-sm font-semibold hover:bg-[var(--wwc-surface-2)]"
            >
              {site?.home_hero_cta_secondary || 'See pricing'}
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">Built for WeatherLink</h2>
        <p className="text-[var(--wwc-muted)] text-sm mt-2 max-w-xl">
          Everything you need to run a station console in the browser — without a local server.
        </p>
        <div className="mt-10 grid sm:grid-cols-2 gap-8">
          {features.map((f) => (
            <div key={f.title}>
              <h3 className="font-semibold text-[var(--wwc-text)]">{f.title}</h3>
              <p className="text-sm text-[var(--wwc-muted)] mt-2 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[var(--wwc-border)] bg-[var(--wwc-surface)]">
        <div className="max-w-5xl mx-auto px-4 py-14 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
              Free for {site?.freeTrialDays ?? 30} days
            </h2>
            <p className="text-sm text-[var(--wwc-muted)] mt-1">
              Then ${site?.yearlyPriceUsd ?? 49}/year per device for WeatherLink Pro.
            </p>
          </div>
          <Link
            to="/register"
            className="inline-flex self-start px-5 py-2.5 rounded-md bg-[var(--wwc-accent)] text-white text-sm font-semibold"
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
  const features = site?.features || [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-14">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Features</h1>
      <p className="text-[var(--wwc-muted)] mt-3 max-w-2xl text-sm leading-relaxed">
        {site?.seo_features_description || 'What you get with WWebConsole.'}
      </p>
      <div className="mt-12 grid gap-10 sm:grid-cols-2">
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
  );
}

export function PricingPage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_pricing_title', 'seo_pricing_description', '/pricing', 'Pricing', '');

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
            ${site?.yearlyPriceUsd ?? 49}
            <span className="text-base font-medium text-[var(--wwc-muted)]"> / year / device</span>
          </p>
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
  const email = site?.site_support_email || 'support@wwebconsole.com';
  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Contact</h1>
      <p className="text-[var(--wwc-muted)] mt-4 text-sm leading-relaxed">{site?.contact_intro || ''}</p>
      <a
        href={`mailto:${email}`}
        className="inline-flex mt-8 text-lg font-semibold text-[var(--wwc-accent)] hover:underline"
      >
        {email}
      </a>
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
