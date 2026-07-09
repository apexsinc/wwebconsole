import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Mail, KeyRound, Trash2, Undo2 } from 'lucide-react';
import { useWeatherStore } from '../store.js';
import {
  cancelAccountDeletion,
  changeAccountPassword,
  confirmEmailChange,
  fetchMe,
  requestAccountDeletion,
  requestEmailChange,
} from '../services/api.js';
import { useTheme } from '../hooks/useTheme.js';

export default function AccountPage() {
  const user = useWeatherStore((s) => s.user);
  const setUser = useWeatherStore((s) => s.setUser);
  const authChecked = useWeatherStore((s) => s.authChecked);
  const setAuthChecked = useWeatherStore((s) => s.setAuthChecked);
  const { isDark } = useTheme();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState(user?.pendingEmail || '');
  const [devCode, setDevCode] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMe();
        if (!cancelled) setUser(me.user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser, setAuthChecked]);

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  const shell = isDark ? 'bg-[#0a0d14] text-white' : 'bg-[#e8edf3] text-slate-900';
  const card = isDark ? 'bg-[#0e111a] border-gray-800' : 'bg-white border-slate-200';
  const input = isDark
    ? 'bg-[#0a0d14] border-gray-800 text-white'
    : 'bg-white border-slate-300 text-slate-900';

  const onPassword = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await changeAccountPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setMsg('Password updated');
    } catch (ex: any) {
      setErr(ex.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const onEmailRequest = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await requestEmailChange(newEmail);
      setPendingEmail(res.email);
      if (res.devCode) setDevCode(res.devCode);
      setMsg(res.devCode ? `Verification code (dev): ${res.devCode}` : 'Verification code sent to the new email');
    } catch (ex: any) {
      setErr(ex.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const onEmailConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await confirmEmailChange(emailCode);
      if (res.user) setUser(res.user);
      setPendingEmail('');
      setEmailCode('');
      setDevCode('');
      setNewEmail('');
      setMsg('Email updated');
    } catch (ex: any) {
      setErr(ex.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await requestAccountDeletion();
      if (res.user) setUser(res.user);
      setMsg(
        `Deletion scheduled for ${res.deleteEffectiveAt ? new Date(res.deleteEffectiveAt).toLocaleString() : '15 days'}. You can cancel anytime before then.`
      );
    } catch (ex: any) {
      setErr(ex.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const onCancelDelete = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await cancelAccountDeletion();
      if (res.user) setUser(res.user);
      setMsg('Account deletion cancelled');
    } catch (ex: any) {
      setErr(ex.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`min-h-screen ${shell}`}>
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <Link to="/app" className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to console
        </Link>
        <h1 className="text-xl font-black tracking-tight">Account settings</h1>
        <p className="text-xs text-slate-500 dark:text-gray-400">{user.email}</p>

        {err && <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/20 rounded-lg px-3 py-2">{err}</p>}
        {msg && <p className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/20 rounded-lg px-3 py-2">{msg}</p>}

        {user.deleteRequestedAt && (
          <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500/30 rounded-xl p-4 text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-200">Deletion pending</p>
            <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-1">
              Scheduled permanently for{' '}
              {user.deleteEffectiveAt ? new Date(user.deleteEffectiveAt).toLocaleString() : '15 days from request'}.
            </p>
            <button
              onClick={onCancelDelete}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-500/40"
            >
              <Undo2 className="w-3.5 h-3.5" /> Cancel deletion
            </button>
          </div>
        )}

        <form onSubmit={onPassword} className={`border rounded-2xl p-5 space-y-3 ${card}`}>
          <div className="flex items-center gap-2 font-bold text-sm">
            <KeyRound className="w-4 h-4 text-sky-500" /> Change password
          </div>
          <input
            type="password"
            required
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-500 ${input}`}
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="New password (min 8)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-500 ${input}`}
          />
          <button disabled={busy} className="px-4 py-2 text-xs font-semibold bg-sky-600 text-white rounded-lg disabled:opacity-50">
            Update password
          </button>
        </form>

        <form onSubmit={onEmailRequest} className={`border rounded-2xl p-5 space-y-3 ${card}`}>
          <div className="flex items-center gap-2 font-bold text-sm">
            <Mail className="w-4 h-4 text-sky-500" /> Change email
          </div>
          <input
            type="email"
            required
            placeholder="New email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-500 ${input}`}
          />
          <button disabled={busy} className="px-4 py-2 text-xs font-semibold bg-sky-600 text-white rounded-lg disabled:opacity-50">
            Send verification code
          </button>
        </form>

        {(pendingEmail || user.pendingEmail) && (
          <form onSubmit={onEmailConfirm} className={`border rounded-2xl p-5 space-y-3 ${card}`}>
            <p className="text-xs text-slate-500">
              Confirm code for <span className="font-mono">{pendingEmail || user.pendingEmail}</span>
              {devCode ? ` · dev code ${devCode}` : ''}
            </p>
            <input
              type="text"
              required
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-sky-500 ${input}`}
            />
            <button disabled={busy} className="px-4 py-2 text-xs font-semibold bg-sky-600 text-white rounded-lg disabled:opacity-50">
              Confirm email
            </button>
          </form>
        )}

        {!user.deleteRequestedAt && user.role !== 'admin' && (
          <div className={`border rounded-2xl p-5 space-y-3 ${card}`}>
            <div className="flex items-center gap-2 font-bold text-sm text-rose-600">
              <Trash2 className="w-4 h-4" /> Delete account
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Account enters a 15-day grace period before permanent deletion. You can cancel during that window.
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder='Type DELETE to confirm'
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500 ${input}`}
            />
            <button
              disabled={busy || deleteConfirm !== 'DELETE'}
              onClick={onDelete}
              className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg disabled:opacity-40"
            >
              Schedule deletion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
