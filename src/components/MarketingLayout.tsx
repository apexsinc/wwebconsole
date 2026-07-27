import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { fetchSiteConfig, type PublicSiteConfig } from '../services/api.js';
import { useTheme } from '../hooks/useTheme.js';

const NAV = [
  { to: '/features', label: 'Features' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export function useSiteConfig() {
  const [site, setSite] = useState<PublicSiteConfig | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchSiteConfig()
      .then((s) => {
        if (!cancelled) setSite(s);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return site;
}

export function applyDocumentSeo(opts: {
  title: string;
  description: string;
  canonicalBase?: string;
  path?: string;
  ogImage?: string;
  keywords?: string;
  indexable?: boolean;
  siteName?: string;
}) {
  if (typeof document === 'undefined') return;
  document.title = opts.title;
  const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.content = content;
  };
  setMeta('name', 'description', opts.description);
  if (opts.keywords) setMeta('name', 'keywords', opts.keywords);
  setMeta('name', 'robots', opts.indexable === false ? 'noindex,nofollow' : 'index,follow');
  setMeta('property', 'og:title', opts.title);
  setMeta('property', 'og:description', opts.description);
  setMeta('property', 'og:type', 'website');
  if (opts.siteName) setMeta('property', 'og:site_name', opts.siteName);
  if (opts.ogImage) setMeta('property', 'og:image', opts.ogImage);
  const base = (opts.canonicalBase || 'https://wwebconsole.com').replace(/\/+$/, '');
  const path = opts.path || '/';
  const canonical = path === '/' ? `${base}/` : `${base}${path}`;
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = canonical;
  setMeta('property', 'og:url', canonical);
}

export function MarketingLayout() {
  const site = useSiteConfig();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const name = site?.site_name || 'Weatherlink Web Console';
  const isHome = location.pathname === '/';

  const trademarkNote =
    site?.site_trademark_note ||
    'WeatherLink® and Davis® are registered trademarks of Davis Instruments Corp. Weatherlink Web Console is an independent product and is not affiliated with, endorsed by, or connected to Davis Instruments or WeatherLink.';

  return (
    <div className="min-h-screen flex flex-col bg-[var(--wwc-page)] text-[var(--wwc-text)]">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#020b18]/80 text-white backdrop-blur-xl transition-colors">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-3 font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-white group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center p-1 border border-white/10 shadow-sm group-hover:bg-white/20 transition-colors">
              <img src="/apexs-logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            {name}
          </Link>
          <nav className="hidden md:flex items-center gap-2">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-4 py-2 text-[15px] rounded-lg transition-all ${
                    isActive
                      ? 'text-sky-300 font-bold bg-white/10 shadow-sm'
                      : 'text-white/80 font-medium hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-md text-white/70 hover:bg-white/10 transition-colors hidden sm:block"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link
              to="/login"
              className="hidden sm:inline-flex text-[15px] font-medium text-white/80 hover:text-white transition-colors px-3"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="hidden sm:inline-flex items-center justify-center text-sm font-bold bg-white text-[#073075] px-4 py-2 rounded-lg hover:bg-sky-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:-translate-y-0.5"
            >
              Start free
            </Link>
            <button
              type="button"
              className="md:hidden p-2 rounded-md text-white/70 hover:bg-white/10 transition-colors"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="md:hidden border-t border-white/10 bg-[#020b18] text-white px-4 py-4 flex flex-col gap-2 shadow-xl">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="py-2.5 px-3 rounded-lg text-sm font-medium text-white/80 hover:bg-white/5 transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <div className="h-px bg-white/10 my-2" />
            <Link to="/login" className="py-2.5 px-3 rounded-lg text-sm font-medium text-white/80 hover:bg-white/5 transition-colors">
              Sign in
            </Link>
            <Link to="/register" className="mt-2 py-3 px-3 text-center rounded-lg text-sm font-bold bg-white text-[#073075] shadow-md hover:bg-sky-50 transition-colors">
              Start free
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet context={{ site }} />
      </main>

      <footer className="border-t border-[var(--wwc-border)] bg-[var(--wwc-surface)] mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-3 text-sm">
          <div>
            <p className="font-[family-name:var(--font-display)] font-bold text-base">{name}</p>
            <p className="text-[var(--wwc-muted)] mt-2 text-xs leading-relaxed">
              {site?.site_footer_text || site?.site_tagline || ''}
            </p>
          </div>
          <div className="flex flex-col gap-2 text-[var(--wwc-muted)]">
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--wwc-text)]">Product</p>
            <Link to="/features" className="hover:text-[var(--wwc-accent)]">
              Features
            </Link>
            <Link to="/changelog" className="hover:text-[var(--wwc-accent)]">
              Changelog
            </Link>
            <Link to="/app" className="hover:text-[var(--wwc-accent)]">
              Open console
            </Link>
          </div>
          <div className="flex flex-col gap-2 text-[var(--wwc-muted)]">
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--wwc-text)]">Company</p>
            <Link to="/about" className="hover:text-[var(--wwc-accent)]">
              About
            </Link>
            <Link to="/contact" className="hover:text-[var(--wwc-accent)]">
              Contact
            </Link>
            <Link to="/privacy" className="hover:text-[var(--wwc-accent)]">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-[var(--wwc-accent)]">
              Terms
            </Link>
          </div>
        </div>
        <div className="border-t border-[var(--wwc-border)] px-4 py-3">
          <p className="max-w-5xl mx-auto text-center text-[10px] leading-relaxed text-[var(--wwc-muted)]/70">
            © {new Date().getFullYear()} {site?.site_company_name || name}
            <span className="mx-1.5 opacity-40">·</span>
            {trademarkNote}
          </p>
        </div>
      </footer>
    </div>
  );
}
