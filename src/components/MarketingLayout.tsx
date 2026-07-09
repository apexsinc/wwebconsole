import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { fetchSiteConfig, type PublicSiteConfig } from '../services/api.js';
import { useTheme } from '../hooks/useTheme.js';

const NAV = [
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
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

  const name = site?.site_name || 'WWebConsole';

  return (
    <div className="min-h-screen flex flex-col bg-[var(--wwc-page)] text-[var(--wwc-text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--wwc-border)] bg-[var(--wwc-surface)]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[var(--wwc-text)]">
            {name}
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm rounded-md transition-colors ${
                    isActive
                      ? 'text-[var(--wwc-accent)] font-semibold'
                      : 'text-[var(--wwc-muted)] hover:text-[var(--wwc-text)]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-md text-[var(--wwc-muted)] hover:bg-[var(--wwc-surface-2)]"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link
              to="/login"
              className="hidden sm:inline-flex text-sm text-[var(--wwc-muted)] hover:text-[var(--wwc-text)] px-2"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="hidden sm:inline-flex text-sm font-semibold bg-[var(--wwc-accent)] text-white px-3 py-1.5 rounded-md hover:opacity-90"
            >
              Start free
            </Link>
            <button
              type="button"
              className="md:hidden p-2 rounded-md text-[var(--wwc-muted)]"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="md:hidden border-t border-[var(--wwc-border)] bg-[var(--wwc-surface)] px-4 py-3 flex flex-col gap-1">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="py-2 text-sm text-[var(--wwc-muted)]">
                {item.label}
              </Link>
            ))}
            <Link to="/login" className="py-2 text-sm">
              Sign in
            </Link>
            <Link to="/register" className="py-2 text-sm font-semibold text-[var(--wwc-accent)]">
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
            <Link to="/pricing" className="hover:text-[var(--wwc-accent)]">
              Pricing
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
        <div className="border-t border-[var(--wwc-border)] px-4 py-4 text-center text-[11px] text-[var(--wwc-muted)]">
          © {new Date().getFullYear()} {site?.site_company_name || name}
        </div>
      </footer>
    </div>
  );
}
