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
  return { text: `${days}d left`, status: 'active' };
}

export default function AdminPage() {
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
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

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

  const handleSaveNotes = async (userId: string) => {
    try {
      await adminUpdateUser(userId, { notes: notesDraft });
      setEditingNotesId(null);
      setMsg('Customer notes updated');
      await load();
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
            <h1 className="font-black text-sm tracking-wider uppercase">Customer & Upgrades Manager</h1>
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

      <div className="max-w-7xl mx-auto p-6">
        {/* Customer KPI Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Stat label="Total Customers" value={overview.users} color="text-slate-900 dark:text-white" />
          <Stat label="Active Pro Devices" value={overview.activePaidDevices} color="text-emerald-500" />
          <Stat label="Active Free Trials" value={overview.activeTrials} color="text-sky-400" />
          <Stat label="Expired / Locked" value={overview.expiredTrials} color="text-amber-400" />
          <Stat label="Suspended Accounts" value={overview.suspended} color="text-rose-400" />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <TabBtn active={tab === 'users'} onClick={() => setTab('users')} icon={Users} label="Customers & Upgrades" />
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
          <div className="space-y-4">
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
                placeholder="Search email, customer name, station name, or DID..."
                className="flex-1 bg-white dark:bg-[#0e111a] border border-slate-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-sky-500/40 text-slate-900 dark:text-white"
              />
              <button className="px-5 py-2.5 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors">
                Search Customers
              </button>
            </form>

            <div className="bg-white dark:bg-[#0e111a] border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-gray-950 text-slate-600 dark:text-gray-400 uppercase tracking-wider border-b border-slate-200 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-3 font-bold">Customer Account</th>
                      <th className="px-4 py-3 font-bold">Plan & Access Status</th>
                      <th className="px-4 py-3 font-bold">Connected Station & DID</th>
                      <th className="px-4 py-3 font-bold">Notes</th>
                      <th className="px-4 py-3 font-bold text-right">Upgrade & Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-900">
                    {users.map((u) => {
                      const isPro = u.billing?.subscriptionStatus === 'active' || u.billing?.subscriptionStatus === 'paid';
                      const expInfo = formatDaysRemaining(
                        isPro ? u.billing?.subscriptionExpiresAt : u.billing?.freeUntil
                      );

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-900/30 transition-colors">
                          {/* Customer info */}
                          <td className="px-4 py-3 align-top">
                            <div className="font-bold text-sm text-slate-900 dark:text-white">{u.email}</div>
                            <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 flex items-center gap-1.5">
                              <span>{u.name || '—'}</span>
                              {u.role === 'admin' && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-500 rounded uppercase">
                                  Admin
                                </span>
                              )}
                              {u.suspended ? (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-500/20 text-rose-400 rounded uppercase">
                                  Suspended
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-1">
                              Joined {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                            </div>
                          </td>

                          {/* Access / Subscription Status */}
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-center gap-1.5">
                              {isPro ? (
                                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" /> Pro Active
                                </span>
                              ) : u.billing?.accessOk ? (
                                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Trial Active
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                  <Ban className="w-3 h-3" /> Access Locked
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300 mt-1.5">
                              {expInfo.text !== '—' && (
                                <span>
                                  {expInfo.status === 'expired' ? 'Expired' : `${expInfo.text}`} (
                                  {new Date(
                                    isPro ? u.billing?.subscriptionExpiresAt : u.billing?.freeUntil
                                  ).toLocaleDateString()}
                                  )
                                </span>
                              )}
                            </div>
                            {u.billing?.accessReason && (
                              <div className="text-[11px] text-amber-500 mt-0.5">{u.billing.accessReason}</div>
                            )}
                          </td>

                          {/* Hardware / Station Info */}
                          <td className="px-4 py-3 align-top font-mono">
                            {u.stationName ? (
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                                  <Radio className="w-3 h-3 text-sky-400 shrink-0" />
                                  <span>{u.stationName}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {u.cloudApiVersion?.toUpperCase() || 'V2'} · DID: {u.cloudDid || 'auto-discovered'}
                                </div>
                                {u.lastHttpAt && (
                                  <div className="text-[10px] text-emerald-500 mt-0.5">
                                    Last poll: {new Date(u.lastHttpAt).toLocaleTimeString()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Unconfigured</span>
                            )}
                          </td>

                          {/* Admin Notes */}
                          <td className="px-4 py-3 align-top max-w-[200px]">
                            {editingNotesId === u.id ? (
                              <div className="flex flex-col gap-1.5">
                                <textarea
                                  value={notesDraft}
                                  onChange={(e) => setNotesDraft(e.target.value)}
                                  rows={2}
                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-sky-500/40 rounded p-1.5 text-xs outline-none text-slate-900 dark:text-white"
                                  placeholder="Internal CRM notes..."
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleSaveNotes(u.id)}
                                    className="px-2 py-0.5 text-[10px] font-bold bg-sky-600 text-white rounded"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingNotesId(null)}
                                    className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-white"
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
                                className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 p-1 rounded min-h-[32px] text-[11px] text-slate-600 dark:text-slate-400 italic"
                                title="Click to edit notes"
                              >
                                {u.notes ? u.notes : '+ Add note...'}
                              </div>
                            )}
                          </td>

                          {/* Upgrade & Actions */}
                          <td className="px-4 py-3 align-top text-right">
                            <div className="flex flex-col items-end gap-1.5">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={async () => {
                                    await adminActivateDevice(u.id, { years: 1, wlPlan: 'pro' });
                                    await load();
                                    setMsg(`Upgraded ${u.email} to Pro (+1 Year)`);
                                  }}
                                  className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md flex items-center gap-1 transition-colors shadow-sm"
                                  title="Activate +1 Year Pro Plan"
                                >
                                  <Zap className="w-3 h-3" /> +1yr Pro
                                </button>
                                <button
                                  onClick={async () => {
                                    await adminActivateDevice(u.id, { years: 2, wlPlan: 'pro' });
                                    await load();
                                    setMsg(`Upgraded ${u.email} to Pro (+2 Years)`);
                                  }}
                                  className="px-2 py-1 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white rounded-md transition-colors"
                                  title="Activate +2 Years Pro Plan"
                                >
                                  +2yr
                                </button>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleExtendTrial(u.id, 30)}
                                  className="px-2 py-1 text-[11px] font-semibold border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 rounded transition-colors"
                                  title="Add +30 Days Free Trial"
                                >
                                  +30d Trial
                                </button>

                                <button
                                  onClick={async () => {
                                    await adminUpdateUser(u.id, { suspended: !u.suspended });
                                    await load();
                                  }}
                                  className="px-2 py-1 text-[11px] font-semibold border border-slate-300 dark:border-gray-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 rounded transition-colors"
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
              Prefer Worker secrets for Turnstile/Resend (`wrangler secret put TURNSTILE_SECRET_KEY` /
              `RESEND_API_KEY`). D1 values are a fallback. Leave secret fields as •••••••• to keep the current value.
              Enable Turnstile in production (`turnstile_enabled=1`).
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

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-white dark:bg-[#0e111a] border border-slate-200 dark:border-gray-800 rounded-xl px-4 py-3 shadow-sm">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">{label}</p>
      <p className={`text-2xl font-black mt-1 ${color || 'text-slate-900 dark:text-white'}`}>{value}</p>
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
      className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors ${
        active
          ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
          : 'border-slate-200 dark:border-gray-800 text-slate-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
