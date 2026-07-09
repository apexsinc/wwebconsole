import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Shield,
  Users,
  Settings,
  Ban,
  CheckCircle2,
  RefreshCw,
  Save,
  Globe,
} from 'lucide-react';
import {
  adminActivateDevice,
  adminGetOverview,
  adminGetSettings,
  adminListUsers,
  adminUpdateSettings,
  adminUpdateUser,
  fetchMe,
  logout,
} from '../services/api.js';
import { useWeatherStore } from '../store.js';

type Tab = 'users' | 'site' | 'settings';

type SettingGroup = { id: string; label: string; keys: string[] };

const TEXTAREA_KEYS = new Set([
  'site_description',
  'site_keywords',
  'site_footer_text',
  'home_hero_subhead',
  'home_features_json',
  'pricing_basic_blurb',
  'pricing_pro_blurb',
  'pricing_footnote',
  'about_body',
  'contact_intro',
  'privacy_body',
  'terms_body',
  'changelog_body',
  'robots_extra',
  'seo_home_description',
  'seo_features_description',
  'seo_pricing_description',
  'seo_about_description',
  'seo_contact_description',
  'seo_privacy_description',
  'seo_terms_description',
  'seo_changelog_description',
]);

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

export default function AdminPage() {
  const user = useWeatherStore((s) => s.user);
  const setUser = useWeatherStore((s) => s.setUser);
  const authChecked = useWeatherStore((s) => s.authChecked);
  const setAuthChecked = useWeatherStore((s) => s.setAuthChecked);
  const [tab, setTab] = useState<Tab>('users');
  const [overview, setOverview] = useState({ users: 0, suspended: 0, activePaidDevices: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [settings, setSettings] = useState<any[]>([]);
  const [groups, setGroups] = useState<SettingGroup[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [siteSection, setSiteSection] = useState('brand');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMe();
        if (!cancelled) setUser(me.user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser, setAuthChecked]);

  const load = async () => {
    setErr('');
    try {
      const [o, u, s] = await Promise.all([adminGetOverview(), adminListUsers(q), adminGetSettings()]);
      setOverview(o);
      setUsers(u.users || []);
      setSettings(s.settings || []);
      setGroups(s.groups || []);
      const d: Record<string, string> = {};
      for (const row of s.settings || []) {
        d[row.key] = row.secret && row.hasValue ? '••••••••' : row.value;
      }
      setDraft(d);
      if (s.groups?.length && !s.groups.find((g) => g.id === siteSection)) {
        setSiteSection(s.groups[0].id);
      }
    } catch (e: any) {
      setErr(e.message || 'Failed to load admin data');
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user?.role]);

  const byKey = useMemo(() => {
    const m = new Map<string, any>();
    for (const row of settings) m.set(row.key, row);
    return m;
  }, [settings]);

  const integrationRows = useMemo(
    () => settings.filter((s) => INTEGRATION_KEYS.has(s.key) || s.group === 'integrations'),
    [settings]
  );

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen bg-[#e8edf3] dark:bg-[#0a0d14] text-slate-500 dark:text-gray-400 flex items-center justify-center">
        Loading admin…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#e8edf3] dark:bg-[#0a0d14] text-slate-900 dark:text-white flex items-center justify-center p-6 text-center">
        <div>
          <Shield className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <h1 className="font-bold text-lg">Admin only</h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-2">Your account is not an admin.</p>
          <Link to="/app" className="text-sky-600 dark:text-sky-400 text-sm mt-4 inline-block">
            Back to console
          </Link>
        </div>
      </div>
    );
  }

  const onSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(draft)) payload[k] = v;
      const res = await adminUpdateSettings(payload);
      setSettings(res.settings || []);
      if (res.groups) setGroups(res.groups);
      setMsg('Settings saved — marketing pages and SEO update immediately');
    } catch (e: any) {
      setErr(e.message || 'Save failed');
    }
  };

  const renderField = (key: string) => {
    const row = byKey.get(key);
    const isSecret = row?.secret;
    const isTextarea = TEXTAREA_KEYS.has(key);
    return (
      <div key={key} className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-gray-500 font-bold block">
          {key}
        </label>
        {isTextarea ? (
          <textarea
            value={draft[key] ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
            rows={key.endsWith('_body') || key === 'home_features_json' ? 10 : 3}
            className="w-full bg-white dark:bg-[#0a0d14] border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-sky-500/40 text-slate-900 dark:text-white"
            placeholder={isSecret ? 'secret value' : ''}
          />
        ) : (
          <input
            value={draft[key] ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
            className="w-full bg-white dark:bg-[#0a0d14] border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-sky-500/40 text-slate-900 dark:text-white"
            placeholder={isSecret ? 'secret value' : ''}
          />
        )}
      </div>
    );
  };

  const activeGroup = groups.find((g) => g.id === siteSection) || groups[0];

  return (
    <div className="min-h-screen bg-[#e8edf3] dark:bg-[#0a0d14] text-slate-900 dark:text-white">
      <header className="border-b border-slate-200 dark:border-gray-900 px-6 py-4 flex items-center justify-between bg-white/80 dark:bg-transparent backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-500/25 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-black text-sm tracking-wider uppercase">WWebConsole Admin</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">admin.wwebconsole.com</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://wwebconsole.com"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-xs border border-slate-200 dark:border-gray-800 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-900"
          >
            View site
          </a>
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs border border-slate-200 dark:border-gray-800 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-900 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={async () => {
              await logout();
              setUser(null);
            }}
            className="px-3 py-1.5 text-xs border border-slate-200 dark:border-gray-800 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-900"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Users" value={overview.users} />
          <Stat label="Suspended" value={overview.suspended} />
          <Stat label="Paid devices" value={overview.activePaidDevices} />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <TabBtn active={tab === 'users'} onClick={() => setTab('users')} icon={Users} label="Users" />
          <TabBtn active={tab === 'site'} onClick={() => setTab('site')} icon={Globe} label="Site & SEO" />
          <TabBtn active={tab === 'settings'} onClick={() => setTab('settings')} icon={Settings} label="Integrations" />
        </div>

        {err && (
          <p className="mb-3 text-rose-600 dark:text-rose-400 text-xs bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/20 rounded-lg px-3 py-2">
            {err}
          </p>
        )}
        {msg && (
          <p className="mb-3 text-emerald-700 dark:text-emerald-400 text-xs bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/20 rounded-lg px-3 py-2">
            {msg}
          </p>
        )}

        {tab === 'users' && (
          <div className="space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                load();
              }}
              className="flex gap-2"
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search email or name"
                className="flex-1 bg-white dark:bg-[#0e111a] border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-500/40"
              />
              <button className="px-4 py-2 text-xs font-semibold bg-sky-600 text-white rounded-lg">Search</button>
            </form>

            <div className="bg-white dark:bg-[#0e111a] border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-gray-950 text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Access</th>
                    <th className="px-3 py-2">WL plan</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100 dark:border-gray-900">
                      <td className="px-3 py-2">
                        <div className="font-semibold">{u.email}</div>
                        <div className="text-slate-500">
                          {u.name} · {u.role}
                          {u.suspended ? ' · SUSPENDED' : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {u.billing?.subscriptionStatus}
                        {!u.billing?.accessOk && (
                          <div className="text-amber-600 dark:text-amber-400 text-[10px]">{u.billing?.accessReason}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">{u.billing?.wlPlan || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={async () => {
                              await adminUpdateUser(u.id, { suspended: !u.suspended });
                              await load();
                            }}
                            className="px-2 py-1 rounded border border-slate-200 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-900 flex items-center gap-1"
                          >
                            {u.suspended ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Ban className="w-3 h-3 text-rose-500" />
                            )}
                            {u.suspended ? 'Unsuspend' : 'Suspend'}
                          </button>
                          <button
                            onClick={async () => {
                              await adminActivateDevice(u.id, { years: 1, wlPlan: 'pro' });
                              await load();
                            }}
                            className="px-2 py-1 rounded border border-slate-200 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-900"
                          >
                            +1yr Pro
                          </button>
                          {u.role !== 'admin' && (
                            <button
                              onClick={async () => {
                                await adminUpdateUser(u.id, { role: 'admin' });
                                await load();
                              }}
                              className="px-2 py-1 rounded border border-slate-200 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-900"
                            >
                              Make admin
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'site' && (
          <form onSubmit={onSaveSettings} className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Edit marketing copy, SEO titles/descriptions, pricing blurbs, and legal pages. Changes apply to
              wwebconsole.com, sitemap.xml, and robots.txt.
            </p>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSiteSection(g.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg border ${
                    activeGroup?.id === g.id
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'border-slate-200 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-900'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="bg-white dark:bg-[#0e111a] border border-slate-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-bold">{activeGroup?.label || 'Site'}</h2>
              {(activeGroup?.keys || []).map((key) => renderField(key))}
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" /> Save site & SEO
              </button>
            </div>
          </form>
        )}

        {tab === 'settings' && (
          <form
            onSubmit={onSaveSettings}
            className="bg-white dark:bg-[#0e111a] border border-slate-200 dark:border-gray-800 rounded-xl p-5 space-y-4"
          >
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Cloudflare Turnstile, Resend email, and poll intervals. Leave secret fields as •••••••• to keep the
              current value. Pricing numbers also appear under Site & SEO → Pricing.
            </p>
            {integrationRows.map((s) => renderField(s.key))}
            {integrationRows.length === 0 &&
              ['turnstile_enabled', 'turnstile_site_key', 'turnstile_secret_key', 'resend_enabled', 'resend_from_email', 'resend_api_key', 'poll_basic_sec', 'poll_pro_sec'].map(
                (k) => renderField(k)
              )}
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Save integrations
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-[#0e111a] border border-slate-200 dark:border-gray-800 rounded-xl px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 ${
        active
          ? 'bg-sky-600 text-white border-sky-600'
          : 'border-slate-200 dark:border-gray-800 text-slate-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
