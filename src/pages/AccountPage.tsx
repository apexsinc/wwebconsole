import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Mail, KeyRound, Trash2, Undo2, ShieldCheck, User } from 'lucide-react';
import { useWeatherStore } from '../store.js';
import {
  cancelAccountDeletion,
  changeAccountPassword,
  confirmEmailChange,
  fetchMe,
  requestAccountDeletion,
  requestEmailChange,
} from '../services/api.js';
import ConfigNavbar from '../components/ConfigNavbar.js';
import { PasswordInput } from '../components/PasswordInput.js';

export default function AccountPage() {
  const user = useWeatherStore((s) => s.user);
  const setUser = useWeatherStore((s) => s.setUser);
  const authChecked = useWeatherStore((s) => s.authChecked);
  const setAuthChecked = useWeatherStore((s) => s.setAuthChecked);

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
    return (
      <div className="min-h-screen bg-[#0a0d14] flex items-center justify-center text-sm font-mono text-slate-400">
        Loading console account details…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const cardCls =
    'bg-white dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/15 rounded-2xl p-6 shadow-sm dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)] space-y-4 transition-colors duration-300';
  const inputCls =
    'bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600/60 focus:border-sky-500 dark:focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all w-full';

  const onPassword = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await changeAccountPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setMsg('Password updated successfully ✓');
    } catch (ex: any) {
      setErr(ex.message || 'Failed to update password');
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
      setErr(ex.message || 'Failed to request email change');
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
      setMsg('Email address updated successfully ✓');
    } catch (ex: any) {
      setErr(ex.message || 'Failed to confirm email change');
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
        `Account deletion scheduled for ${
          res.deleteEffectiveAt ? new Date(res.deleteEffectiveAt).toLocaleString() : '15 days'
        }. You can cancel anytime before then.`
      );
    } catch (ex: any) {
      setErr(ex.message || 'Failed to schedule deletion');
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
      setMsg('Account deletion cancelled ✓');
    } catch (ex: any) {
      setErr(ex.message || 'Failed to cancel deletion');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0a0d14] text-slate-900 dark:text-white flex flex-col font-sans select-none transition-colors duration-300">
      <ConfigNavbar />

      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 md:p-8 space-y-6">
        {/* Header navigation & user profile summary */}
        <div className="flex flex-col gap-3">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300 transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Console Dashboard
          </Link>

          <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex items-center justify-between shadow-sm dark:shadow-xl transition-colors duration-300">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Account Settings</h1>
                <p className="text-sm font-mono text-slate-500 dark:text-slate-400 mt-0.5">{user.email}</p>
              </div>
            </div>
            {user.role === 'admin' && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono font-bold rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" /> ADMIN
              </span>
            )}
          </div>
        </div>

        {/* Alerts & Messages */}
        {err && (
          <div className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 rounded-xl px-4 py-3 font-semibold">
            {err}
          </div>
        )}
        {msg && (
          <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 rounded-xl px-4 py-3 font-semibold">
            {msg}
          </div>
        )}

        {/* Account Deletion Pending Warning Banner */}
        {user.deleteRequestedAt && (
          <div className="border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-5 space-y-2">
            <p className="font-bold text-amber-800 dark:text-amber-300 text-base">Account Deletion Scheduled</p>
            <p className="text-xs text-amber-700 dark:text-amber-200/90 leading-relaxed">
              Your account is scheduled for permanent deletion on{' '}
              <span className="font-mono font-bold">
                {user.deleteEffectiveAt ? new Date(user.deleteEffectiveAt).toLocaleString() : '15 days from request'}
              </span>
              . You can cancel this request at any time before then.
            </p>
            <button
              onClick={onCancelDelete}
              disabled={busy}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all active:scale-95 disabled:opacity-50"
            >
              <Undo2 className="w-3.5 h-3.5" /> Cancel Deletion Request
            </button>
          </div>
        )}

        {/* Responsive 2-Column Grid Layout for Full-Screen Fit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left Column: Change Password */}
          <form onSubmit={onPassword} className={cardCls}>
            <div className="flex items-center gap-2 font-bold text-base text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3">
              <KeyRound className="w-5 h-5 text-sky-600 dark:text-sky-400" /> Change Security Password
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold">Current Password</label>
                <PasswordInput
                  required
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold">New Password</label>
                <PasswordInput
                  required
                  minLength={8}
                  placeholder="Enter new password (minimum 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                disabled={busy}
                className="px-5 py-2.5 text-sm font-semibold bg-sky-600 dark:bg-sky-500 hover:bg-sky-500 dark:hover:bg-sky-400 text-white rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-sm dark:shadow-[0_0_15px_rgba(56,189,248,0.2)] cursor-pointer"
              >
                {busy ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>

          {/* Right Column: Change Email & Confirm Email */}
          <div className="space-y-6">
            <form onSubmit={onEmailRequest} className={cardCls}>
              <div className="flex items-center gap-2 font-bold text-base text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3">
                <Mail className="w-5 h-5 text-sky-600 dark:text-sky-400" /> Change Account Email
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold">New Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. new.email@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  disabled={busy}
                  className="px-5 py-2.5 text-sm font-semibold bg-sky-600 dark:bg-sky-500 hover:bg-sky-500 dark:hover:bg-sky-400 text-white rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-sm dark:shadow-[0_0_15px_rgba(56,189,248,0.2)] cursor-pointer"
                >
                  {busy ? 'Sending…' : 'Send Verification Code'}
                </button>
              </div>
            </form>

            {(pendingEmail || user.pendingEmail) && (
              <form onSubmit={onEmailConfirm} className={cardCls}>
                <div className="space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Enter verification code for <span className="font-mono text-sky-600 dark:text-sky-300 font-bold">{pendingEmail || user.pendingEmail}</span>
                    {devCode ? ` · dev code: ${devCode}` : ''}
                  </p>
                  <input
                    type="text"
                    required
                    placeholder="Enter 6-digit verification code"
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    className={`${inputCls} font-mono tracking-widest text-center text-lg`}
                  />
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    disabled={busy}
                    className="px-5 py-2.5 text-sm font-semibold bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 rounded-xl transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? 'Confirming…' : 'Confirm Email Address'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Danger Zone: Delete Account */}
        {!user.deleteRequestedAt && user.role !== 'admin' && (
          <div className={`${cardCls} border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20`}>
            <div className="flex items-center gap-2 font-bold text-base text-rose-600 dark:text-rose-400 border-b border-rose-200 dark:border-rose-500/20 pb-3">
              <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" /> Danger Zone: Delete Account
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Account enters a 15-day grace period before permanent deletion. You can log back in and cancel deletion at any time during that window.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs text-rose-700 dark:text-rose-300 uppercase tracking-wider font-bold">Confirmation</label>
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                className={`${inputCls} border-rose-300 dark:border-rose-500/40 focus:border-rose-500 dark:focus:border-rose-400`}
              />
            </div>
            <div className="pt-2 flex justify-end">
              <button
                disabled={busy || deleteConfirm !== 'DELETE'}
                onClick={onDelete}
                className="px-5 py-2.5 text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:scale-100 cursor-pointer"
              >
                Schedule Account Deletion
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
