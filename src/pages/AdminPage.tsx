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
  Sparkles,
  Clock,
  Radio,
  FileText,
  UserCheck,
  Zap,
  Search,
  ExternalLink,
  LogOut,
  ChevronRight,
  TrendingUp,
  Activity,
  Edit3,
  X,
  Sun,
  Moon,
  Thermometer,
  Wind,
  Droplets,
  Gauge,
  Compass,
  MapPin,
  Eye,
  AlertTriangle,
  ChevronDown,
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
        <span className="text-xs font-mono tracking-wider uppercase font-semibold">Loading Admin Dashboard…</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070a11] text-slate-900 dark:text-white flex items-center justify-center p-6 text-center select-none">
        <div className="max-w-md w-full bg-white dark:bg-[#0d121f] border border-rose-500/20 rounded-2xl p-8 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto mb-4">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="font-bold text-xl text-slate-900 dark:text-white">Admin Access Restricted</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 leading-relaxed">
            Your account (<span className="text-slate-800 dark:text-slate-200 font-mono">{user.email}</span>) does not have administrator privileges.
          </p>
          <Link
            to="/app"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-xl transition-all shadow-lg"
          >
            Return to Live Console
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

  const renderField = (key: string) => {
    const row = byKey.get(key);
    const isSecret = row?.secret;
    const isTextarea = TEXTAREA_KEYS.has(key);
    return (
      <div key={key} className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold block">
          {key}
        </label>
        {isTextarea ? (
          <textarea
            value={draft[key] ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
            rows={key.endsWith('_body') || key === 'home_features_json' ? 8 : 3}
            className="w-full bg-slate-50 dark:bg-[#090d16] border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all"
            placeholder={isSecret ? 'secret value' : ''}
          />
        ) : (
          <input
            value={draft[key] ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
            className="w-full bg-slate-50 dark:bg-[#090d16] border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all"
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
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#070a11]/80 backdrop-blur-xl px-6 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.15)]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm tracking-wide text-slate-900 dark:text-white uppercase">WWebConsole Executive Admin</h1>
              <span className="flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" /> Live
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">admin.wwebconsole.com · {user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl transition-all cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-sky-600" />}
          </button>

          <a
            href="https://wwebconsole.com"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl transition-all flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Public Site</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>

          <button
            onClick={load}
            disabled={refreshing}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-sky-500' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={async () => {
              await logout();
              setUser(null);
            }}
            className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Dashboard Body */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* KPI Executive Summary Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard
            title="Total Customers"
            value={overview.users}
            sub="Registered Accounts"
            icon={Users}
            accentColor="border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/10"
          />
          <KpiCard
            title="Active Pro Devices"
            value={overview.activePaidDevices}
            sub="Paid Subscriptions"
            icon={Zap}
            accentColor="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
          />
          <KpiCard
            title="Active Free Trials"
            value={overview.activeTrials}
            sub="60-Day Trial Active"
            icon={Clock}
            accentColor="border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10"
          />
          <KpiCard
            title="Expired / Locked"
            value={overview.expiredTrials}
            sub="Trial Ended"
            icon={Ban}
            accentColor="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
          />
          <KpiCard
            title="Suspended Accounts"
            value={overview.suspended}
            sub="Blocked Access"
            icon={Shield}
            accentColor="border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <NavTab active={tab === 'users'} onClick={() => setTab('users')} icon={Users} label="Customer Directory & Upgrades" />
            <NavTab active={tab === 'site'} onClick={() => setTab('site')} icon={Globe} label="Site Copy & SEO" />
            <NavTab active={tab === 'settings'} onClick={() => setTab('settings')} icon={Settings} label="API & Integrations" />
          </div>
        </div>

        {/* Notifications */}
        {err && (
          <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between">
            <span>{err}</span>
            <button onClick={() => setErr('')} className="p-1 hover:text-slate-900 dark:hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        )}
        {msg && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg('')} className="p-1 hover:text-slate-900 dark:hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ── Customers & Upgrades Directory ── */}
        {tab === 'users' && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-white/10 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm dark:shadow-xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  load();
                }}
                className="flex-1 flex items-center gap-3 bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-white/10 focus-within:border-sky-500 rounded-xl px-4 py-2 transition-all"
              >
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search customer email, name, station name, or device DID..."
                  className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none font-sans"
                />
                {q && (
                  <button type="button" onClick={() => setQ('')} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button type="submit" className="px-3.5 py-1 text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white rounded-lg transition-colors">
                  Search
                </button>
              </form>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono px-2">
                Click customer row to view all devices · <span className="text-slate-900 dark:text-white font-bold">{users.length}</span> records
              </div>
            </div>

            {/* Customers Table */}
            <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#090d16] text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="px-5 py-3.5">Customer Account</th>
                      <th className="px-5 py-3.5">Subscription & Access</th>
                      <th className="px-5 py-3.5">Connected Station & Hardware</th>
                      <th className="px-5 py-3.5">CRM Notes</th>
                      <th className="px-5 py-3.5 text-right">Upgrade & Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {users.map((u) => {
                      const isPro = u.billing?.subscriptionStatus === 'active' || u.billing?.subscriptionStatus === 'paid';
                      const expInfo = formatDaysRemaining(
                        isPro ? u.billing?.subscriptionExpiresAt : u.billing?.freeUntil
                      );
                      const stationCount = u.weather?.weatherList?.length || (u.cloudDid ? 1 : 0);

                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors group cursor-pointer"
                          onClick={() => setSelectedUser(u)}
                        >
                          {/* Customer info */}
                          <td className="px-5 py-4 align-top">
                            <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-300 transition-colors flex items-center gap-2">
                              <span>{u.email}</span>
                              <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-sky-500 transition-opacity" />
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 text-xs mt-1 flex items-center gap-1.5 flex-wrap">
                              <span>{u.name || '—'}</span>
                              {u.role === 'admin' && (
                                <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-full uppercase">
                                  Admin
                                </span>
                              )}
                              {u.suspended ? (
                                <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-full uppercase">
                                  Suspended
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-1.5">
                              Registered: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                            </div>
                          </td>

                          {/* Access / Subscription Status */}
                          <td className="px-5 py-4 align-top">
                            <div className="flex items-center gap-2">
                              {isPro ? (
                                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" /> Pro Active
                                </span>
                              ) : u.billing?.accessOk ? (
                                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 dark:bg-sky-400 animate-pulse" /> Trial Active
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-rose-400" /> Access Locked
                                </span>
                              )}
                            </div>

                            <div className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 mt-2 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {expInfo.text !== '—' && (
                                <span>
                                  {expInfo.status === 'expired' ? (
                                    <span className="text-amber-600 dark:text-amber-400 font-bold">Expired</span>
                                  ) : (
                                    <span className="text-sky-600 dark:text-sky-300">{expInfo.text}</span>
                                  )}
                                  <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                                    ({new Date(isPro ? u.billing?.subscriptionExpiresAt : u.billing?.freeUntil).toLocaleDateString()})
                                  </span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Hardware / Station Info */}
                          <td className="px-5 py-4 align-top font-mono">
                            {u.stationName ? (
                              <div className="space-y-1">
                                <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                                  <Radio className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                  <span>{u.stationName}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded text-[10px] text-sky-600 dark:text-sky-300 font-bold mr-1">
                                    {u.cloudApiVersion?.toUpperCase() || 'V2'}
                                  </span>
                                  <span>DID: {u.cloudDid || 'auto-discovered'}</span>
                                </div>
                                <div className="text-[10px] text-sky-600 dark:text-sky-400 font-sans font-bold flex items-center gap-1">
                                  <span>{stationCount} station{stationCount > 1 ? 's' : ''} configured</span>
                                  <ChevronRight className="w-3 h-3" />
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 text-xs italic">Unconfigured</span>
                            )}
                          </td>

                          {/* Admin Notes */}
                          <td
                            className="px-5 py-4 align-top max-w-[200px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {editingNotesId === u.id ? (
                              <div className="flex flex-col gap-2">
                                <textarea
                                  value={notesDraft}
                                  onChange={(e) => setNotesDraft(e.target.value)}
                                  rows={2}
                                  className="w-full bg-slate-50 dark:bg-[#070a11] border border-sky-400 rounded-xl p-2 text-xs outline-none text-slate-900 dark:text-white font-sans"
                                  placeholder="Enter internal CRM notes..."
                                />
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleSaveNotes(u.id)}
                                    className="px-2.5 py-1 text-[10px] font-bold bg-sky-500 hover:bg-sky-400 text-white rounded-lg"
                                  >
                                    Save Note
                                  </button>
                                  <button
                                    onClick={() => setEditingNotesId(null)}
                                    className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
                                className="group/note cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent hover:border-slate-200 dark:hover:border-white/10 p-2 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-all min-h-[36px] flex items-start justify-between gap-1"
                                title="Click to edit notes"
                              >
                                <span className="italic">{u.notes ? u.notes : '+ Add note...'}</span>
                                <Edit3 className="w-3 h-3 opacity-0 group-hover/note:opacity-100 text-sky-500 shrink-0 mt-0.5" />
                              </div>
                            )}
                          </td>

                          {/* Upgrade Actions */}
                          <td
                            className="px-5 py-4 align-top text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={async () => {
                                    await adminActivateDevice(u.id, { years: 1, wlPlan: 'pro' });
                                    await load();
                                    setMsg(`Upgraded ${u.email} to Pro (+1 Year)`);
                                  }}
                                  className="px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                                  title="Activate +1 Year Pro Plan"
                                >
                                  <Zap className="w-3.5 h-3.5 fill-current" /> +1yr Pro
                                </button>
                                <button
                                  onClick={async () => {
                                    await adminActivateDevice(u.id, { years: 2, wlPlan: 'pro' });
                                    await load();
                                    setMsg(`Upgraded ${u.email} to Pro (+2 Years)`);
                                  }}
                                  className="px-2.5 py-1.5 text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 rounded-xl transition-all cursor-pointer"
                                  title="Activate +2 Years Pro Plan"
                                >
                                  +2yr
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleExtendTrial(u.id, 30)}
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-600 dark:text-sky-300 rounded-lg transition-all cursor-pointer"
                                  title="Add +30 Days Free Trial"
                                >
                                  +30d Trial
                                </button>

                                <button
                                  onClick={async () => {
                                    await adminUpdateUser(u.id, { suspended: !u.suspended });
                                    await load();
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-lg transition-all cursor-pointer"
                                >
                                  {u.suspended ? 'Unsuspend' : 'Suspend'}
                                </button>
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
          <form onSubmit={onSaveSettings} className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage marketing page text, SEO title/descriptions, pricing blurbs, and legal agreements. Changes update wwebconsole.com, sitemap.xml, and robots.txt in real-time.
            </p>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSiteSection(g.id)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    activeGroup?.id === g.id
                      ? 'bg-sky-500 text-white border-sky-400 shadow-lg'
                      : 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-5 shadow-sm dark:shadow-2xl">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-500" />
                {activeGroup?.label || 'Site Section'}
              </h2>
              {(activeGroup?.keys || []).map((key) => renderField(key))}
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                <Save className="w-4 h-4" /> Save Site Copy & SEO
              </button>
            </div>
          </form>
        )}

        {/* ── Integrations Tab ── */}
        {tab === 'settings' && (
          <form
            onSubmit={onSaveSettings}
            className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-5 shadow-sm dark:shadow-2xl"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Configure Turnstile bot protection, Resend API key, and polling intervals. For maximum security, use Worker secrets (`wrangler secret put TURNSTILE_SECRET_KEY`).
            </p>
            {integrationRows.map((s) => renderField(s.key))}
            {integrationRows.length === 0 &&
              ['turnstile_enabled', 'turnstile_site_key', 'turnstile_secret_key', 'resend_enabled', 'resend_from_email', 'resend_api_key', 'poll_basic_sec', 'poll_pro_sec'].map(
                (k) => renderField(k)
              )}
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-lg"
            >
              <Save className="w-4 h-4" /> Save Integrations
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
            adminActivateDevice(selectedUser.id, { years, wlPlan: 'pro' }).then(() => {
              load();
              setMsg(`Activated +${years}yr Pro for ${selectedUser.email}`);
              setSelectedUser(null);
            });
          }}
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
}: {
  customer: any;
  onClose: () => void;
  onExtendTrial: (days: number) => void;
  onActivatePro: (years: number) => void;
}) {
  const isPro = customer.billing?.subscriptionStatus === 'active' || customer.billing?.subscriptionStatus === 'paid';
  const weatherList: any[] = customer.weather?.weatherList || (customer.weather?.ts ? [customer.weather] : []);
  const stationName = customer.stationName || 'WeatherLink Station';
  const apiVersion = (customer.cloudApiVersion || 'v2').toUpperCase();
  const dids = customer.cloudDid || 'auto-discovered';

  const unitTemp: 'F' | 'C' = customer.unitTemp || 'C';
  const unitWind: 'mph' | 'kmh' | 'kts' | 'ms' = customer.unitWind || 'kmh';
  const unitBaro: 'inHg' | 'hPa' | 'mmHg' | 'mb' = customer.unitBaro || 'hPa';
  const unitRain: 'in' | 'mm' = customer.unitRain || 'mm';

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-white/10 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Modal Header Banner */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070a11] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-500">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{customer.email}</h3>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 rounded-full">
                  API {apiVersion}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full">
                  Units: {getTempUnit(unitTemp)} · {getWindUnit(unitWind)} · {getBaroUnit(unitBaro)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Customer ID: <span className="font-mono text-slate-700 dark:text-slate-300">{customer.id}</span> · Joined {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          {/* Subscription Quick Info & Override Bar */}
          <div className="bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold block">Current Access Tier</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  isPro
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : customer.billing?.accessOk
                    ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                }`}>
                  {isPro ? 'Pro Subscription' : customer.billing?.accessOk ? '60-Day Free Trial' : 'Access Expired'}
                </span>
                <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                  {isPro
                    ? `Expires: ${new Date(customer.billing.subscriptionExpiresAt).toLocaleDateString()}`
                    : `Free until: ${new Date(customer.freeUntil).toLocaleDateString()}`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onActivatePro(1)}
                className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Zap className="w-3.5 h-3.5" /> +1 Year Pro
              </button>
              <button
                onClick={() => onExtendTrial(30)}
                className="px-3 py-1.5 text-xs font-bold bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-600 dark:text-sky-300 rounded-xl transition-all"
              >
                +30d Trial
              </button>
            </div>
          </div>

          {/* Configured Station Metadata */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400">
              Station Configuration & Network Metadata
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-white/10 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 font-mono block">Station Name</span>
                <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">{stationName}</span>
              </div>
              <div className="bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-white/10 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 font-mono block">Configured DID(s)</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white mt-0.5 block truncate">{dids}</span>
              </div>
              <div className="bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-white/10 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 font-mono block">Timezone / Location</span>
                <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                  {customer.timezone || 'UTC'} {customer.latitude ? `(${customer.latitude.toFixed(2)}, ${customer.longitude?.toFixed(2)})` : ''}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-white/10 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 font-mono block">Poll Interval / Last Http</span>
                <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                  {customer.pollIntervalSec || 900}s · {customer.lastHttpAt ? new Date(customer.lastHttpAt).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>

            {customer.lastError && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Last Polling Error: {customer.lastError}</span>
              </div>
            )}
          </div>

          {/* Configured Devices Live Weather Telemetry List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400">
                Configured Weather Devices ({weatherList.length})
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">Live telemetry in customer units ({getTempUnit(unitTemp)}, {getWindUnit(unitWind)}, {getBaroUnit(unitBaro)})</span>
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
                    <div key={idx} className="bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                        <div className="flex items-center gap-2">
                          <Radio className="w-4 h-4 text-sky-500 animate-pulse" />
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{w.stationName || `Device ${idx + 1}`}</span>
                        </div>
                        <span className="font-mono text-[10px] px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300">
                          DID: {w.stationDid || 'N/A'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-white/5 rounded-xl p-2.5">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1"><Thermometer className="w-3 h-3 text-amber-500" /> Temperature</span>
                          <span className="font-black text-base text-slate-900 dark:text-white mt-0.5 block">
                            {tVal != null ? `${tVal.toFixed(1)}${getTempUnit(unitTemp)}` : '—'}
                            {fVal != null && (
                              <span className="text-xs text-slate-400 font-normal ml-1">feels {fVal.toFixed(1)}°</span>
                            )}
                          </span>
                        </div>

                        <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-white/5 rounded-xl p-2.5">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1"><Droplets className="w-3 h-3 text-sky-500" /> Humidity / Dew</span>
                          <span className="font-black text-base text-slate-900 dark:text-white mt-0.5 block">
                            {w.hum != null ? `${w.hum}%` : '—'}
                            {dVal != null && (
                              <span className="text-xs text-slate-400 font-normal ml-1">dew {dVal.toFixed(1)}°</span>
                            )}
                          </span>
                        </div>

                        <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-white/5 rounded-xl p-2.5">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1"><Gauge className="w-3 h-3 text-purple-500" /> Barometer</span>
                          <span className="font-black text-base text-slate-900 dark:text-white mt-0.5 block">
                            {pVal != null ? `${pVal.toFixed(unitBaro === 'inHg' ? 2 : 1)} ${getBaroUnit(unitBaro)}` : '—'}
                          </span>
                        </div>

                        <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-white/5 rounded-xl p-2.5">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1"><Wind className="w-3 h-3 text-teal-500" /> Wind Speed</span>
                          <span className="font-black text-base text-slate-900 dark:text-white mt-0.5 block">
                            {wVal != null ? `${wVal.toFixed(1)} ${getWindUnit(unitWind)}` : '—'}
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] font-mono text-slate-400 flex justify-between items-center pt-1 border-t border-slate-200 dark:border-white/5">
                        <span>Sunrise: {w.sunrise || '--'} · Sunset: {w.sunset || '--'}</span>
                        <span>{w.ts ? new Date(w.ts * 1000).toLocaleTimeString() : ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center text-slate-400 text-xs italic">
                No active weather telemetry reported yet for this account.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070a11] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-xl transition-all cursor-pointer"
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
  icon: Icon,
  accentColor,
}: {
  title: string;
  value: number;
  sub: string;
  icon: typeof Users;
  accentColor: string;
}) {
  return (
    <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-sm dark:shadow-xl transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400 font-bold">{title}</span>
        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${accentColor}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3">
        <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</span>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function NavTab({
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
      className={`px-4 py-2 text-xs font-bold rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
        active
          ? 'bg-sky-500/15 border-sky-500/40 text-sky-600 dark:text-sky-300 shadow-sm'
          : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/10'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
