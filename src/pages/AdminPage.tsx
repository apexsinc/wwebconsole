import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Shield,
  Users,
  Settings,
  Ban,
  CheckCircle2,
  RefreshCw,
  Save,
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

type Tab = 'users' | 'settings';

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
  const [draft, setDraft] = useState<Record<string, string>>({});
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
      const d: Record<string, string> = {};
      for (const row of s.settings || []) {
        d[row.key] = row.secret && row.hasValue ? '••••••••' : row.value;
      }
      setDraft(d);
    } catch (e: any) {
      setErr(e.message || 'Failed to load admin data');
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user?.role]);

  if (loading || !authChecked) {
    return <div className="min-h-screen bg-[#0a0d14] text-gray-400 flex items-center justify-center">Loading admin…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#0a0d14] text-white flex items-center justify-center p-6 text-center">
        <div>
          <Shield className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <h1 className="font-bold text-lg">Admin only</h1>
          <p className="text-gray-400 text-sm mt-2">Your account is not an admin.</p>
          <Link to="/" className="text-sky-400 text-sm mt-4 inline-block">
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
      setMsg('Settings saved');
    } catch (e: any) {
      setErr(e.message || 'Save failed');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white">
      <header className="border-b border-gray-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-950/40 border border-sky-500/25 flex items-center justify-center text-sky-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-black text-sm tracking-wider uppercase">WWebConsole Admin</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">admin.wwebconsole.com</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="px-3 py-1.5 text-xs border border-gray-800 rounded-lg hover:bg-gray-900 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={async () => {
              await logout();
              setUser(null);
            }}
            className="px-3 py-1.5 text-xs border border-gray-800 rounded-lg hover:bg-gray-900"
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

        <div className="flex gap-2 mb-4">
          <TabBtn active={tab === 'users'} onClick={() => setTab('users')} icon={Users} label="Users" />
          <TabBtn active={tab === 'settings'} onClick={() => setTab('settings')} icon={Settings} label="Integrations" />
        </div>

        {err && <p className="mb-3 text-rose-400 text-xs bg-rose-950/30 border border-rose-500/20 rounded-lg px-3 py-2">{err}</p>}
        {msg && <p className="mb-3 text-emerald-400 text-xs bg-emerald-950/30 border border-emerald-500/20 rounded-lg px-3 py-2">{msg}</p>}

        {tab === 'users' ? (
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
                className="flex-1 bg-[#0e111a] border border-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-500/40"
              />
              <button className="px-4 py-2 text-xs font-semibold bg-sky-600 rounded-lg">Search</button>
            </form>

            <div className="bg-[#0e111a] border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-950 text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Access</th>
                    <th className="px-3 py-2">WL plan</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-gray-900">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-white">{u.email}</div>
                        <div className="text-gray-500">{u.name} · {u.role}{u.suspended ? ' · SUSPENDED' : ''}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-300">
                        {u.billing?.subscriptionStatus}
                        {!u.billing?.accessOk && <div className="text-amber-400 text-[10px]">{u.billing?.accessReason}</div>}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-300">{u.billing?.wlPlan || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={async () => {
                              await adminUpdateUser(u.id, { suspended: !u.suspended });
                              await load();
                            }}
                            className="px-2 py-1 rounded border border-gray-800 hover:bg-gray-900 flex items-center gap-1"
                          >
                            {u.suspended ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Ban className="w-3 h-3 text-rose-400" />}
                            {u.suspended ? 'Unsuspend' : 'Suspend'}
                          </button>
                          <button
                            onClick={async () => {
                              await adminActivateDevice(u.id, { years: 1, wlPlan: 'pro' });
                              await load();
                            }}
                            className="px-2 py-1 rounded border border-gray-800 hover:bg-gray-900"
                          >
                            +1yr Pro
                          </button>
                          {u.role !== 'admin' && (
                            <button
                              onClick={async () => {
                                await adminUpdateUser(u.id, { role: 'admin' });
                                await load();
                              }}
                              className="px-2 py-1 rounded border border-gray-800 hover:bg-gray-900"
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
        ) : (
          <form onSubmit={onSaveSettings} className="bg-[#0e111a] border border-gray-800 rounded-xl p-5 space-y-4">
            <p className="text-xs text-gray-400">
              Configure Cloudflare Turnstile and Resend. Leave secret fields as •••••••• to keep the current value.
            </p>
            {settings.map((s) => (
              <div key={s.key} className="grid grid-cols-[200px_1fr] gap-3 items-center">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{s.key}</label>
                <input
                  value={draft[s.key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                  className="bg-[#0a0d14] border border-gray-800 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-sky-500/40"
                  placeholder={s.secret ? 'secret value' : ''}
                />
              </div>
            ))}
            <button type="submit" className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 rounded-lg flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Save settings
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#0e111a] border border-gray-800 rounded-xl px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{label}</p>
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
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 ${
        active ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'border-gray-800 text-gray-400'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
