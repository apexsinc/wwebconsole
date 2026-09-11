import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Search,
  X,
  Sun,
  Moon,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  adminActivateDevice,
  adminDeleteUser,
  adminGetOverview,
  adminGetSettings,
  adminListUsers,
  adminUpdateSettings,
  adminUpdateUser,
  fetchMe,
  logout,
} from '../services/api.js';
import { useWeatherStore } from '../store.js';
import { useTheme } from '../hooks/useTheme.js';

type Tab = 'users' | 'site' | 'settings';
type SettingGroup = { id: string; label: string; keys: string[] };

const TEXTAREA_KEYS = new Set([
  'site_description',
  'site_keywords',
  'site_footer_text',
  'site_trademark_note',
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

function formatDaysRemaining(targetTs: number | null | undefined): { text: string; status: 'active' | 'expired' | 'none' } {
  if (!targetTs || !Number.isFinite(targetTs)) return { text: '—', status: 'none' };
  const diff = targetTs - Date.now();
  if (diff <= 0) return { text: 'Expired', status: 'expired' };
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return { text: `${days}d remaining`, status: 'active' };
}

export default function AdminPage() {
  const { theme, toggleTheme } = useTheme();
  const user = useWeatherStore((s) => s.user);
  const setUser = useWeatherStore((s) => s.setUser);
  const authChecked = useWeatherStore((s) => s.authChecked);
  const setAuthChecked = useWeatherStore((s) => s.setAuthChecked);

  const [tab, setTab] = useState<Tab>('users');
  const [overview, setOverview] = useState({
    users: 0,
    suspended: 0,
    activePaidDevices: 0,
    activeTrials: 0,
    expiredTrials: 0,
  });
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [settings, setSettings] = useState<any[]>([]);
  const [groups, setGroups] = useState<SettingGroup[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [siteSection, setSiteSection] = useState('brand');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

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
    setRefreshing(true);
    setErr('');
    try {
      const [o, u, s] = await Promise.all([adminGetOverview(), adminListUsers(q), adminGetSettings()]);
      setOverview({
        users: o.users || 0,
        suspended: o.suspended || 0,
        activePaidDevices: o.activePaidDevices || 0,
        activeTrials: (o as any).activeTrials || 0,
        expiredTrials: (o as any).expiredTrials || 0,
      });
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
    } finally {
      setRefreshing(false);
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
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070a11] text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-3 font-sans select-none">
        <div className="w-8 h-8 rounded-full border-2 border-sky-500/30 border-t-sky-500 animate-spin" />
        <span className="text-sm font-semibold tracking-wider uppercase">Loading Admin Dashboard…</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070a11] text-slate-900 dark:text-white flex items-center justify-center p-6 text-center select-none">
        <div className="max-w-md w-full bg-white dark:bg-[#0d121f] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl">
          <h1 className="font-bold text-xl text-slate-900 dark:text-white">Customer Account Detected</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-3 leading-relaxed">
            Your account (<span className="text-slate-900 dark:text-white font-mono font-medium">{user.email}</span>) is registered as a standard customer account. Executive administrator privileges are required for this portal.
          </p>
          <a
            href="https://wwebconsole.com/app"
            className="mt-6 inline-flex items-center justify-center px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Go to Live Weather Console
          </a>
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
      setMsg('Settings saved — site copy & SEO updated immediately');
    } catch (e: any) {
      setErr(e.message || 'Save failed');
    }
  };

  const handleSaveNotes = async (userId: string) => {
    try {
      await adminUpdateUser(userId, { notes: notesDraft });
      setEditingNotesId(null);
      setMsg('Customer CRM notes updated');
      await load();
      if (selectedUser?.id === userId) {
        setSelectedUser((prev: any) => (prev ? { ...prev, notes: notesDraft } : null));
      }
    } catch (e: any) {
      setErr(e.message || 'Failed to update notes');
    }
  };

  const handleExtendTrial = async (userId: string, days: number) => {
    try {
      await adminUpdateUser(userId, { extendTrialDays: days });
      setMsg(`Extended free trial by +${days} days`);
      await load();
    } catch (e: any) {
      setErr(e.message || 'Failed to extend trial');
    }
  };

  const handleDeleteUser = async (u: any) => {
    if (
      !window.confirm(
        `Are you sure you want to PERMANENTLY delete customer account "${u.email}"?\n\nThis will remove all associated stations, credentials, and session tokens. This action CANNOT be undone.`
      )
    ) {
      return;
    }
    try {
      await adminDeleteUser(u.id);
      setMsg(`Customer account ${u.email} has been permanently deleted.`);
      if (selectedUser?.id === u.id) setSelectedUser(null);
      await load();
    } catch (e: any) {
      setErr(e.message || 'Failed to delete user');
    }
  };

  const renderField = (key: string) => {
    const row = byKey.get(key);
    const isSecret = row?.secret;
    const isTextarea = TEXTAREA_KEYS.has(key);
    return (
      <div key={key} className="space-y-2">
        <label className="text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 font-semibold block">
          {key}
        </label>
        {isTextarea ? (
          <textarea
            value={draft[key] ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
            rows={key.endsWith('_body') || key === 'home_features_json' ? 8 : 3}
            className="w-full bg-white dark:bg-[#070a11] border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all"
            placeholder={isSecret ? 'secret value' : ''}
          />
        ) : (
          <input
            value={draft[key] ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
            className="w-full bg-white dark:bg-[#070a11] border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all"
            placeholder={isSecret ? 'secret value' : ''}
          />
        )}
      </div>
    );
  };

  const activeGroup = groups.find((g) => g.id === siteSection) || groups[0];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070a11] text-slate-900 dark:text-slate-100 font-sans selection:bg-sky-500 selection:text-white transition-colors duration-200">
      
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#070a11]/95 backdrop-blur-md px-6 lg:px-8 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
                WWebConsole
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase tracking-wider">
                Admin
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 ml-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              admin.wwebconsole.com <span className="opacity-40">·</span> {user.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/80 rounded-xl transition-all cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          <a
            href="https://wwebconsole.com"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/80 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>Public Site</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </a>

          <button
            onClick={load}
            disabled={refreshing}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/80 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-sky-500' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={async () => {
              await logout();
              setUser(null);
            }}
            className="px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/60 rounded-xl transition-all cursor-pointer"
          >
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Dashboard Body */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 space-y-8">
        
        {/* KPI Executive Summary Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard
            title="Total Customers"
            value={overview.users}
            sub="Registered Accounts"
          />
          <KpiCard
            title="Active Pro Devices"
            value={overview.activePaidDevices}
            sub="Paid Subscriptions"
          />
          <KpiCard
            title="Active Free Trials"
            value={overview.activeTrials}
            sub="60-Day Trial Active"
          />
          <KpiCard
            title="Expired / Locked"
            value={overview.expiredTrials}
            sub="Trial Ended"
          />
          <KpiCard
            title="Suspended Accounts"
            value={overview.suspended}
            sub="Blocked Access"
          />
        </div>

        {/* Minimalist Segmented Tabs */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTab('users')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                tab === 'users'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Customer Directory & Upgrades
            </button>
            <button
              type="button"
              onClick={() => setTab('site')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                tab === 'site'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Site Copy & SEO
            </button>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                tab === 'settings'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              API & Integrations
            </button>
          </div>
        </div>

        {/* Notifications */}
        {err && (
          <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3 text-rose-700 dark:text-rose-300 text-sm font-medium flex items-center justify-between">
            <span>{err}</span>
            <button onClick={() => setErr('')} className="p-1 hover:text-rose-900 dark:hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        )}
        {msg && (
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 text-emerald-700 dark:text-emerald-300 text-sm font-medium flex items-center justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg('')} className="p-1 hover:text-emerald-900 dark:hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ── Customers & Upgrades Directory ── */}
        {tab === 'users' && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  load();
                }}
                className="flex-1 flex items-center gap-3 bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-slate-700/80 focus-within:border-sky-500 rounded-xl px-4 py-2.5 transition-all"
              >
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search customer email, name, station name, or device DID..."
                  className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none font-sans"
                />
                {q && (
                  <button type="button" onClick={() => setQ('')} className="text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button type="submit" className="px-4 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                  Search
                </button>
              </form>

              <div className="text-sm text-slate-500 dark:text-slate-400 px-2">
                Click any row for station telemetry <span className="opacity-40">·</span> <span className="text-slate-900 dark:text-white font-semibold">{users.length}</span> records
              </div>
            </div>

            {/* Customers Table */}
            <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-[#090d16] text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Customer Account</th>
                      <th className="px-6 py-4">Subscription & Access</th>
                      <th className="px-6 py-4">Connected Station & Hardware</th>
                      <th className="px-6 py-4">CRM Notes</th>
                      <th className="px-6 py-4 text-right">Upgrade & Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {users.map((u) => {
                      const isPro = u.billing?.subscriptionStatus === 'active' || u.billing?.subscriptionStatus === 'paid';
                      const expInfo = formatDaysRemaining(
                        isPro ? u.billing?.subscriptionExpiresAt : u.billing?.freeUntil
                      );
                      const stationCount = u.weather?.weatherList?.length || (u.cloudDid ? 1 : 0);

                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer"
                          onClick={() => setSelectedUser(u)}
                        >
                          {/* Customer info */}
                          <td className="px-6 py-5 align-top">
                            <div className="font-semibold text-base text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                              {u.email}
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 text-sm mt-1 flex items-center gap-2 flex-wrap">
                              <span>{u.name || '—'}</span>
                              {u.role === 'admin' && (
                                <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 rounded-md uppercase tracking-wide">
                                  Admin
                                </span>
                              )}
                              {u.suspended && (
                                <span className="px-2 py-0.5 text-xs font-semibold bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-400 rounded-md uppercase tracking-wide">
                                  Suspended
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                              Registered {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                            </div>
                          </td>

                          {/* Access / Subscription Status */}
                          <td className="px-6 py-5 align-top">
                            <div className="flex items-center gap-2">
                              {isPro ? (
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                                  Pro Active
                                </span>
                              ) : u.billing?.accessOk ? (
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/25">
                                  Trial Active
                                </span>
                              ) : (
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25">
                                  Access Locked
                                </span>
                              )}
                            </div>

                            <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-2">
                              {expInfo.text !== '—' && (
                                <>
                                  {expInfo.status === 'expired' ? (
                                    <span className="text-amber-600 dark:text-amber-400 font-semibold">Expired</span>
                                  ) : (
                                    <span className="text-sky-600 dark:text-sky-400 font-semibold">{expInfo.text}</span>
                                  )}
                                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-1.5 font-normal">
                                    ({new Date(isPro ? u.billing?.subscriptionExpiresAt : u.billing?.freeUntil).toLocaleDateString()})
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Hardware / Station Info */}
                          <td className="px-6 py-5 align-top">
                            {u.stationName ? (
                              <div className="space-y-1">
                                <div className="font-semibold text-slate-900 dark:text-white text-sm">
                                  {u.stationName}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 font-medium">
                                    {u.cloudApiVersion?.toUpperCase() || 'V2'}
                                  </span>
                                  <span className="font-mono">DID: {u.cloudDid || 'auto-discovered'}</span>
                                </div>
                                <div className="text-xs text-sky-600 dark:text-sky-400 font-medium">
                                  {stationCount} station{stationCount > 1 ? 's' : ''} configured
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 text-sm italic">Unconfigured</span>
                            )}
                          </td>

                          {/* Admin Notes */}
                          <td
                            className="px-6 py-5 align-top max-w-[220px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {editingNotesId === u.id ? (
                              <div className="flex flex-col gap-2">
                                <textarea
                                  value={notesDraft}
                                  onChange={(e) => setNotesDraft(e.target.value)}
                                  rows={2}
                                  className="w-full bg-white dark:bg-[#070a11] border border-sky-500 rounded-xl p-2.5 text-sm outline-none text-slate-900 dark:text-white font-sans"
                                  placeholder="Enter internal CRM notes..."
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleSaveNotes(u.id)}
                                    className="px-3 py-1 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingNotesId(null)}
                                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setEditingNotesId(u.id);
                                  setNotesDraft(u.notes || '');
                                }}
                                className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 p-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-all min-h-[36px]"
                                title="Click to edit notes"
                              >
                                {u.notes ? u.notes : <span className="text-slate-400 dark:text-slate-500 italic">+ Add note...</span>}
                              </div>
                            )}
                          </td>

                          {/* Upgrade Actions */}
                          <td
                            className="px-6 py-5 align-top text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={async () => {
                                    try {
                                      await adminActivateDevice(u.id, { years: 1, wlPlan: 'pro' });
                                      await load();
                                      setMsg(`Upgraded ${u.email} to Pro (+1 Year)`);
                                    } catch (e: any) {
                                      setErr(e.message || `Failed to upgrade ${u.email} to Pro`);
                                    }
                                  }}
                                  className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-xs cursor-pointer"
                                  title="Activate +1 Year Pro Plan"
                                >
                                  +1yr Pro
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await adminActivateDevice(u.id, { years: 2, wlPlan: 'pro' });
                                      await load();
                                      setMsg(`Upgraded ${u.email} to Pro (+2 Years)`);
                                    } catch (e: any) {
                                      setErr(e.message || `Failed to upgrade ${u.email} to Pro`);
                                    }
                                  }}
                                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl transition-all cursor-pointer"
                                  title="Activate +2 Years Pro Plan"
                                >
                                  +2yr
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleExtendTrial(u.id, 30)}
                                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-all cursor-pointer"
                                  title="Add +30 Days Free Trial"
                                >
                                  +30d Trial
                                </button>

                                <button
                                  onClick={async () => {
                                    await adminUpdateUser(u.id, { suspended: !u.suspended });
                                    await load();
                                  }}
                                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-all cursor-pointer"
                                >
                                  {u.suspended ? 'Unsuspend' : 'Suspend'}
                                </button>

                                {u.role !== 'admin' && (
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    className="px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                                    title="Delete Customer Account"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Site & SEO Tab ── */}
        {tab === 'site' && (
          <form onSubmit={onSaveSettings} className="space-y-6">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Manage marketing page text, SEO title/descriptions, pricing blurbs, and legal agreements. Changes update wwebconsole.com, sitemap.xml, and robots.txt in real-time.
            </p>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSiteSection(g.id)}
                  className={`px-4 py-2 text-sm font-semibold rounded-xl border transition-all cursor-pointer ${
                    activeGroup?.id === g.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1320] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-xs">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {activeGroup?.label || 'Site Section'}
              </h2>
              {(activeGroup?.keys || []).map((key) => renderField(key))}
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Save Site Copy & SEO
              </button>
            </div>
          </form>
        )}

        {/* ── Integrations Tab ── */}
        {tab === 'settings' && (
          <form
            onSubmit={onSaveSettings}
            className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-xs"
          >
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Configure Turnstile bot protection, Resend API key, and polling intervals. For maximum security, use Worker secrets (`wrangler secret put TURNSTILE_SECRET_KEY`).
            </p>
            {integrationRows.map((s) => renderField(s.key))}
            {integrationRows.length === 0 &&
              ['turnstile_enabled', 'turnstile_site_key', 'turnstile_secret_key', 'resend_enabled', 'resend_from_email', 'resend_api_key', 'poll_basic_sec', 'poll_pro_sec'].map(
                (k) => renderField(k)
              )}
            <button
              type="submit"
              className="px-6 py-2.5 text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-all cursor-pointer shadow-xs"
            >
              Save Integrations
            </button>
          </form>
        )}
      </div>

      {/* ── Interactive Customer Station Inspection Modal ── */}
      {selectedUser && (
        <UserStationsModal
          customer={selectedUser}
          onClose={() => setSelectedUser(null)}
          onExtendTrial={(days) => handleExtendTrial(selectedUser.id, days)}
          onActivatePro={(years) => {
            adminActivateDevice(selectedUser.id, { years, wlPlan: 'pro' })
              .then(() => {
                load();
                setMsg(`Activated +${years}yr Pro for ${selectedUser.email}`);
                setSelectedUser(null);
              })
              .catch((e: any) => {
                setErr(e.message || `Failed to activate Pro for ${selectedUser.email}`);
              });
          }}
          onDeleteAccount={() => handleDeleteUser(selectedUser)}
        />
      )}
    </div>
  );
}

function convertTemp(tempF: number, unit?: 'F' | 'C') {
  if (unit === 'C') return ((tempF - 32) * 5) / 9;
  return tempF;
}
function getTempUnit(unit?: 'F' | 'C') {
  return unit === 'C' ? '°C' : '°F';
}

function convertWind(speedMph: number, unit?: 'mph' | 'kmh' | 'kts' | 'ms') {
  if (unit === 'kmh') return speedMph * 1.60934;
  if (unit === 'kts') return speedMph * 0.868976;
  if (unit === 'ms') return speedMph * 0.44704;
  return speedMph;
}
function getWindUnit(unit?: 'mph' | 'kmh' | 'kts' | 'ms') {
  if (unit === 'kmh') return 'km/h';
  if (unit === 'kts') return 'kts';
  if (unit === 'ms') return 'm/s';
  return 'mph';
}

function convertBaro(baroInHg: number, unit?: 'inHg' | 'hPa' | 'mmHg' | 'mb') {
  if (unit === 'hPa' || unit === 'mb') return baroInHg * 33.8639;
  if (unit === 'mmHg') return baroInHg * 25.4;
  return baroInHg;
}
function getBaroUnit(unit?: 'inHg' | 'hPa' | 'mmHg' | 'mb') {
  if (unit === 'hPa') return 'hPa';
  if (unit === 'mb') return 'mb';
  if (unit === 'mmHg') return 'mm Hg';
  return 'inHg';
}

{/* Modal to view all configured stations and live weather telemetry for a user */}
function UserStationsModal({
  customer,
  onClose,
  onExtendTrial,
  onActivatePro,
  onDeleteAccount,
}: {
  customer: any;
  onClose: () => void;
  onExtendTrial: (days: number) => void;
  onActivatePro: (years: number) => void;
  onDeleteAccount?: () => void;
}) {
  const isPro = customer.billing?.subscriptionStatus === 'active' || customer.billing?.subscriptionStatus === 'paid';
  const weatherList: any[] = customer.weather?.weatherList || (customer.weather?.ts ? [customer.weather] : []);
  const stationName = customer.stationName || 'WeatherLink Station';
  const apiVersion = (customer.cloudApiVersion || 'v2').toUpperCase();
  const dids = customer.cloudDid || 'auto-discovered';

  const unitTemp: 'F' | 'C' = customer.unitTemp || 'C';
  const unitWind: 'mph' | 'kmh' | 'kts' | 'ms' = customer.unitWind || 'kmh';
  const unitBaro: 'inHg' | 'hPa' | 'mmHg' | 'mb' = customer.unitBaro || 'hPa';

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070a11] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">{customer.email}</h3>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 rounded-md">
                API {apiVersion}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">
                Units: {getTempUnit(unitTemp)} · {getWindUnit(unitWind)} · {getBaroUnit(unitBaro)}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Customer ID: <span className="font-mono text-slate-700 dark:text-slate-300">{customer.id}</span> · Joined {new Date(customer.createdAt).toLocaleDateString()}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          {/* Subscription Quick Info & Override Bar */}
          <div className="bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold block">Current Access Tier</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  isPro
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25'
                    : customer.billing?.accessOk
                    ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/25'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25'
                }`}>
                  {isPro ? 'Pro Subscription' : customer.billing?.accessOk ? '60-Day Free Trial' : 'Access Expired'}
                </span>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {isPro
                    ? `Expires: ${new Date(customer.billing.subscriptionExpiresAt).toLocaleDateString()}`
                    : `Free until: ${new Date(customer.freeUntil).toLocaleDateString()}`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onActivatePro(1)}
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs transition-all cursor-pointer"
              >
                +1 Year Pro
              </button>
              <button
                onClick={() => onExtendTrial(30)}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all cursor-pointer"
              >
                +30d Trial
              </button>
            </div>
          </div>

          {/* Configured Station Metadata */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">
              Station Configuration & Network Metadata
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-medium block">Station Name</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-1 block truncate">{stationName}</span>
              </div>
              <div className="bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-medium block">Configured DID(s)</span>
                <span className="font-semibold font-mono text-slate-900 dark:text-white mt-1 block truncate">{dids}</span>
              </div>
              <div className="bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-medium block">Timezone / Location</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-1 block truncate">
                  {customer.timezone || 'UTC'} {customer.latitude ? `(${customer.latitude.toFixed(2)}, ${customer.longitude?.toFixed(2)})` : ''}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-medium block">Poll Interval / Last Http</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-1 block truncate">
                  {customer.pollIntervalSec || 900}s · {customer.lastHttpAt ? new Date(customer.lastHttpAt).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>

            {customer.lastError && (
              <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Last Polling Error: {customer.lastError}</span>
              </div>
            )}
          </div>

          {/* Configured Devices Live Weather Telemetry List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">
                Configured Weather Devices ({weatherList.length})
              </h4>
              <span className="text-xs text-slate-400">Live telemetry in customer units ({getTempUnit(unitTemp)}, {getWindUnit(unitWind)}, {getBaroUnit(unitBaro)})</span>
            </div>

            {weatherList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weatherList.map((w: any, idx: number) => {
                  const tVal = w.temp != null ? convertTemp(w.temp, unitTemp) : null;
                  const fVal = w.feels_like != null ? convertTemp(w.feels_like, unitTemp) : null;
                  const dVal = w.dew_point != null ? convertTemp(w.dew_point, unitTemp) : null;
                  const pVal = w.bar_sea_level != null ? convertBaro(w.bar_sea_level, unitBaro) : null;
                  const wVal = w.wind_speed_last != null ? convertWind(w.wind_speed_last, unitWind) : null;

                  return (
                    <div key={idx} className="bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                        <span className="font-semibold text-base text-slate-900 dark:text-white">{w.stationName || `Device ${idx + 1}`}</span>
                        <span className="font-mono text-xs px-2.5 py-1 bg-slate-200 dark:bg-slate-800 rounded-md text-slate-700 dark:text-slate-300">
                          DID: {w.stationDid || 'N/A'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block uppercase tracking-wider">Temperature</span>
                          <span className="font-bold text-xl text-slate-900 dark:text-white mt-1 block">
                            {tVal != null ? `${tVal.toFixed(1)}${getTempUnit(unitTemp)}` : '—'}
                            {fVal != null && (
                              <span className="text-xs text-slate-500 font-normal ml-2">feels {fVal.toFixed(1)}°</span>
                            )}
                          </span>
                        </div>

                        <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block uppercase tracking-wider">Humidity / Dew</span>
                          <span className="font-bold text-xl text-slate-900 dark:text-white mt-1 block">
                            {w.hum != null ? `${w.hum}%` : '—'}
                            {dVal != null && (
                              <span className="text-xs text-slate-500 font-normal ml-2">dew {dVal.toFixed(1)}°</span>
                            )}
                          </span>
                        </div>

                        <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block uppercase tracking-wider">Barometer</span>
                          <span className="font-bold text-xl text-slate-900 dark:text-white mt-1 block">
                            {pVal != null ? `${pVal.toFixed(unitBaro === 'inHg' ? 2 : 1)} ${getBaroUnit(unitBaro)}` : '—'}
                          </span>
                        </div>

                        <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block uppercase tracking-wider">Wind Speed</span>
                          <span className="font-bold text-xl text-slate-900 dark:text-white mt-1 block">
                            {wVal != null ? `${wVal.toFixed(1)} ${getWindUnit(unitWind)}` : '—'}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                        <span>Sunrise: {w.sunrise || '--'} · Sunset: {w.sunset || '--'}</span>
                        <span>{w.ts ? new Date(w.ts * 1000).toLocaleTimeString() : ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm italic">
                No active weather telemetry reported yet for this account.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070a11] flex items-center justify-between">
          <div>
            {customer.role !== 'admin' && onDeleteAccount && (
              <button
                onClick={onDeleteAccount}
                className="px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer"
              >
                Delete Customer Account
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl transition-all cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
      <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
        {title}
      </span>
      <div className="mt-4">
        <span className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
          {value}
        </span>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {sub}
        </p>
      </div>
    </div>
  );
}
