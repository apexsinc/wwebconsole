import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import {
  fetchAuthConfig,
  forgotPassword,
  login,
  register,
  resendVerification,
  resetPassword,
  verifyEmail,
} from '../services/api.js';
import { useWeatherStore } from '../store.js';
import { PasswordInput } from '../components/PasswordInput.js';

function isAdminHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'admin.wwebconsole.com' || host.startsWith('admin.') || host === 'admin.localhost';
}

/** After login/register/verify: admin host → admin home; main site → console. */
function postAuthPath() {
  return isAdminHost() ? '/' : '/app';
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        }
      ) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
      ready?: (cb: () => void) => void;
    };
  }
}

function useTurnstile(siteKey: string, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [scriptError, setScriptError] = useState('');
  const widgetId = useRef<string | null>(null);

  const reset = useCallback(() => {
    setToken('');
    if (widgetId.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetId.current);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled || !siteKey) {
      setReady(false);
      setToken('');
      return;
    }

    let cancelled = false;
    setReady(false);
    setToken('');
    setScriptError('');

    const mount = () => {
      if (cancelled || !ref.current || !window.turnstile) return;
      if (widgetId.current) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
        widgetId.current = null;
      }
      // Clear any leftover iframe markup before re-render
      ref.current.innerHTML = '';
      try {
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (t) => {
            if (!cancelled) {
              setToken(t);
              setReady(true);
            }
          },
          'expired-callback': () => {
            if (!cancelled) {
              setToken('');
              setReady(false);
            }
          },
          'error-callback': () => {
            if (!cancelled) {
              setToken('');
              setReady(false);
              setScriptError('Turnstile failed to load. Refresh and try again.');
            }
          },
        });
      } catch (err: any) {
        if (!cancelled) setScriptError(err?.message || 'Turnstile failed to render');
      }
    };

    const whenApiReady = (cb: () => void) => {
      if (window.turnstile?.render) {
        cb();
        return;
      }
      if (typeof window.turnstile?.ready === 'function') {
        window.turnstile.ready(cb);
        return;
      }
      // Poll briefly if script tag exists but API not yet attached
      let tries = 0;
      const id = window.setInterval(() => {
        if (cancelled) {
          window.clearInterval(id);
          return;
        }
        if (window.turnstile?.render) {
          window.clearInterval(id);
          cb();
        } else if (++tries > 40) {
          window.clearInterval(id);
          if (!cancelled) setScriptError('Turnstile script timed out');
        }
      }, 100);
    };

    if (window.turnstile?.render) {
      mount();
    } else {
      const existing = document.querySelector('script[data-wwc-turnstile]') as HTMLScriptElement | null;
      if (!existing) {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.dataset.wwcTurnstile = '1';
        s.onload = () => whenApiReady(mount);
        s.onerror = () => {
          if (!cancelled) setScriptError('Could not load Turnstile. Check network / ad blockers.');
        };
        document.head.appendChild(s);
      } else {
        whenApiReady(mount);
      }
    }

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
        widgetId.current = null;
      }
    };
  }, [enabled, siteKey]);

  return { ref, token, ready, scriptError, reset, required: enabled && Boolean(siteKey) };
}

function TurnstileField({
  enabled,
  turnstile,
}: {
  enabled: boolean;
  turnstile: ReturnType<typeof useTurnstile>;
}) {
  if (!enabled) return null;
  return (
    <div className="mt-2 space-y-1 w-full flex flex-col items-center">
      <div ref={turnstile.ref} />
      {turnstile.scriptError && (
        <p className="text-rose-400 text-xs text-center">{turnstile.scriptError}</p>
      )}
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const setUser = useWeatherStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authCfg, setAuthCfg] = useState({ turnstileEnabled: false, turnstileSiteKey: '' });
  const turnstile = useTurnstile(authCfg.turnstileSiteKey, authCfg.turnstileEnabled);

  useEffect(() => {
    fetchAuthConfig().then(setAuthCfg).catch(() => undefined);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (turnstile.required && !turnstile.token) {
      setError('Complete the security check before signing in.');
      return;
    }
    setLoading(true);
    try {
      const { user } = await login(email, password, turnstile.token || undefined);
      setUser(user);
      navigate(postAuthPath());
    } catch (err: any) {
      turnstile.reset();
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        navigate(`/verify?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Sign in" subtitle={isAdminHost() ? 'Admin sign in' : 'Open your WeatherLink console'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {error && <p className="text-rose-400 text-xs bg-rose-950/40 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-slate-50 dark:bg-[#05080f] border border-slate-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-[#073075] dark:focus:border-[#073075] focus:ring-4 focus:ring-[#073075]/10 dark:focus:ring-[#073075]/20 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
        />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Password</label>
        <PasswordInput
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full bg-slate-50 dark:bg-[#05080f] border border-slate-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-[#073075] dark:focus:border-[#073075] focus:ring-4 focus:ring-[#073075]/10 dark:focus:ring-[#073075]/20 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
        />
        <TurnstileField enabled={authCfg.turnstileEnabled} turnstile={turnstile} />
        <button
          type="submit"
          disabled={loading || (turnstile.required && !turnstile.token)}
          className="w-full mt-4 bg-[#073075] hover:bg-[#0a3f99] disabled:opacity-50 text-white font-bold text-sm rounded-xl py-3.5 shadow-lg hover:shadow-[0_8px_20px_-4px_rgba(7,48,117,0.4)] transition-all"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-xs text-gray-500 text-center mt-3 font-medium">
          <Link to="/forgot-password" className="text-[#073075] dark:text-sky-400 hover:underline font-bold">
            Forgot password?
          </Link>
          {!isAdminHost() && (
            <>
              <span className="mx-2 opacity-50">&middot;</span>
              <Link to="/register" className="text-[#073075] dark:text-sky-400 hover:underline font-bold">
                Create account
              </Link>
            </>
          )}
        </p>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const setUser = useWeatherStore((s) => s.setUser);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [authCfg, setAuthCfg] = useState({ turnstileEnabled: false, turnstileSiteKey: '', freeTrialDays: 30 });
  const turnstile = useTurnstile(authCfg.turnstileSiteKey, authCfg.turnstileEnabled);

  useEffect(() => {
    fetchAuthConfig().then(setAuthCfg).catch(() => undefined);
  }, []);

  const passwordsMatch = confirmPassword === '' || password === confirmPassword;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (turnstile.required && !turnstile.token) {
      setError('Complete the security check before creating an account.');
      return;
    }
    setLoading(true);
    try {
      const res = await register(email, password, name || undefined, turnstile.token || undefined);
      if (res.needsVerification) {
        navigate(`/verify?email=${encodeURIComponent(email)}`);
        return;
      }
      if (res.user) {
        setUser(res.user);
        navigate(postAuthPath());
        return;
      }
      // Anti-enumeration: existing/blocked emails get a generic message (no verify redirect)
      setInfo(res.message || 'If this email can be registered, check your inbox. Otherwise sign in.');
      turnstile.reset();
    } catch (err: any) {
      turnstile.reset();
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle={`${authCfg.freeTrialDays || 30}-day free access · then yearly per device (WeatherLink Pro)`}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {error && (
          <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/20 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-rose-700 dark:text-rose-400 text-xs font-semibold leading-relaxed">{error}</p>
          </div>
        )}
        {info && (
          <div className="flex items-start gap-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-emerald-700 dark:text-emerald-400 text-xs font-semibold leading-relaxed">{info}</p>
          </div>
        )}
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          className="bg-slate-50 dark:bg-[#05080f] border border-slate-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-[#073075] dark:focus:border-[#073075] focus:ring-4 focus:ring-[#073075]/10 dark:focus:ring-[#073075]/20 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
        />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="bg-slate-50 dark:bg-[#05080f] border border-slate-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-[#073075] dark:focus:border-[#073075] focus:ring-4 focus:ring-[#073075]/10 dark:focus:ring-[#073075]/20 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
        />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Password</label>
        <PasswordInput
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="Min. 8 characters"
          className="w-full bg-slate-50 dark:bg-[#05080f] border border-slate-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-[#073075] dark:focus:border-[#073075] focus:ring-4 focus:ring-[#073075]/10 dark:focus:ring-[#073075]/20 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
        />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Confirm Password</label>
        <PasswordInput
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          className={`w-full bg-slate-50 dark:bg-[#05080f] border rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-4 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 ${
            !passwordsMatch
              ? 'border-rose-400 dark:border-rose-500 focus:border-rose-400 focus:ring-rose-400/10'
              : confirmPassword && password === confirmPassword
              ? 'border-emerald-400 dark:border-emerald-500 focus:border-emerald-400 focus:ring-emerald-400/10'
              : 'border-slate-200 dark:border-gray-800 focus:border-[#073075] dark:focus:border-[#073075] focus:ring-[#073075]/10 dark:focus:ring-[#073075]/20'
          }`}
        />
        {confirmPassword && !passwordsMatch && (
          <p className="text-rose-500 dark:text-rose-400 text-xs font-semibold -mt-1 flex items-center gap-1">
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Passwords don't match
          </p>
        )}
        {confirmPassword && password === confirmPassword && (
          <p className="text-emerald-500 dark:text-emerald-400 text-xs font-semibold -mt-1 flex items-center gap-1">
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Passwords match
          </p>
        )}
        <TurnstileField enabled={authCfg.turnstileEnabled} turnstile={turnstile} />
        <button
          type="submit"
          disabled={loading || (turnstile.required && !turnstile.token) || (!passwordsMatch && confirmPassword !== '')}
          className="w-full mt-4 bg-[#073075] hover:bg-[#0a3f99] disabled:opacity-50 text-white font-bold text-sm rounded-xl py-3.5 shadow-lg hover:shadow-[0_8px_20px_-4px_rgba(7,48,117,0.4)] transition-all"
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>
        <p className="text-xs text-gray-500 text-center mt-3 font-medium">
          Already have an account?{' '}
          <Link to="/login" className="text-[#073075] dark:text-sky-400 hover:underline font-bold">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const setUser = useWeatherStore((s) => s.setUser);
  const params = new URLSearchParams(window.location.search);
  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [authCfg, setAuthCfg] = useState({ turnstileEnabled: false, turnstileSiteKey: '' });
  const turnstile = useTurnstile(authCfg.turnstileSiteKey, authCfg.turnstileEnabled);

  useEffect(() => {
    fetchAuthConfig().then(setAuthCfg).catch(() => undefined);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (turnstile.required && !turnstile.token) {
      setError('Complete the security check first.');
      return;
    }
    setLoading(true);
    try {
      const { user } = await verifyEmail(email, code, turnstile.token || undefined);
      setUser(user);
      navigate(postAuthPath());
    } catch (err: any) {
      turnstile.reset();
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setInfo('');
    setError('');
    if (turnstile.required && !turnstile.token) {
      setError('Complete the security check before resending.');
      return;
    }
    try {
      await resendVerification(email, turnstile.token || undefined);
      setInfo('A new code was sent if the account exists.');
      turnstile.reset();
    } catch (err: any) {
      turnstile.reset();
      setError(err.message || 'Could not resend');
    }
  };

  return (
    <AuthShell title="Verify email" subtitle="Enter the 6-digit code we sent to your email">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {error && <p className="text-rose-400 text-xs bg-rose-950/40 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
        {info && <p className="text-emerald-400 text-xs bg-emerald-950/40 border border-emerald-500/20 rounded-lg px-3 py-2">{info}</p>}
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-slate-50 dark:bg-[#05080f] border border-slate-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-[#073075] dark:focus:border-[#073075] focus:ring-4 focus:ring-[#073075]/10 dark:focus:ring-[#073075]/20 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
        />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Code</label>
        <input
          type="text"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="bg-slate-50 dark:bg-[#0a0d14] border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white tracking-[0.3em] font-mono outline-none focus:border-sky-500/50"
        />
        <TurnstileField enabled={authCfg.turnstileEnabled} turnstile={turnstile} />
        <button
          type="submit"
          disabled={loading || (turnstile.required && !turnstile.token)}
          className="w-full mt-4 bg-[#073075] hover:bg-[#0a3f99] disabled:opacity-50 text-white font-bold text-sm rounded-xl py-3.5 shadow-lg hover:shadow-[0_8px_20px_-4px_rgba(7,48,117,0.4)] transition-all"
        >
          {loading ? 'Verifying…' : 'Verify & continue'}
        </button>
        <button type="button" onClick={onResend} className="text-xs text-[#073075] dark:text-sky-400 hover:underline mt-2 font-bold">
          Resend code
        </button>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authCfg, setAuthCfg] = useState({ turnstileEnabled: false, turnstileSiteKey: '' });
  const turnstile = useTurnstile(authCfg.turnstileSiteKey, authCfg.turnstileEnabled);

  useEffect(() => {
    fetchAuthConfig().then(setAuthCfg).catch(() => undefined);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (turnstile.required && !turnstile.token) {
      setError('Complete the security check first.');
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email, turnstile.token || undefined);
      setSent(true);
    } catch (err: any) {
      turnstile.reset();
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Forgot password" subtitle="We'll email a one-time reset code">
      {sent ? (
        <div className="text-sm text-gray-300 space-y-3">
          <p>If that email exists, a reset code was sent.</p>
          <Link to={`/reset-password?email=${encodeURIComponent(email)}`} className="text-[#073075] dark:text-sky-400 hover:underline font-bold mt-2 inline-block">
            Enter reset code →
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {error && <p className="text-rose-400 text-xs bg-rose-950/40 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
          <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-slate-50 dark:bg-[#05080f] border border-slate-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-[#073075] dark:focus:border-[#073075] focus:ring-4 focus:ring-[#073075]/10 dark:focus:ring-[#073075]/20 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
          />
          <TurnstileField enabled={authCfg.turnstileEnabled} turnstile={turnstile} />
          <button
            type="submit"
            disabled={loading || (turnstile.required && !turnstile.token)}
            className="w-full mt-4 bg-[#073075] hover:bg-[#0a3f99] disabled:opacity-50 text-white font-bold text-sm rounded-xl py-3.5 shadow-lg hover:shadow-[0_8px_20px_-4px_rgba(7,48,117,0.4)] transition-all"
          >
            {loading ? 'Sending…' : 'Send reset code'}
          </button>
          <Link to="/login" className="text-xs text-[#073075] dark:text-sky-400 hover:underline text-center mt-2 font-bold">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authCfg, setAuthCfg] = useState({ turnstileEnabled: false, turnstileSiteKey: '' });
  const turnstile = useTurnstile(authCfg.turnstileSiteKey, authCfg.turnstileEnabled);

  useEffect(() => {
    fetchAuthConfig().then(setAuthCfg).catch(() => undefined);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (turnstile.required && !turnstile.token) {
      setError('Complete the security check first.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, code, password, turnstile.token || undefined);
      navigate('/login');
    } catch (err: any) {
      turnstile.reset();
      setError(err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset password" subtitle="Enter the OTP from your email">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {error && <p className="text-rose-400 text-xs bg-rose-950/40 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-slate-50 dark:bg-[#05080f] border border-slate-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-[#073075] dark:focus:border-[#073075] focus:ring-4 focus:ring-[#073075]/10 dark:focus:ring-[#073075]/20 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Code</label>
        <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} className="bg-slate-50 dark:bg-[#05080f] border border-slate-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white font-mono outline-none focus:border-[#073075] dark:focus:border-[#073075] focus:ring-4 focus:ring-[#073075]/10 dark:focus:ring-[#073075]/20 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">New password</label>
        <PasswordInput
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full bg-slate-50 dark:bg-[#05080f] border border-slate-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-[#073075] dark:focus:border-[#073075] focus:ring-4 focus:ring-[#073075]/10 dark:focus:ring-[#073075]/20 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
        />
        <TurnstileField enabled={authCfg.turnstileEnabled} turnstile={turnstile} />
        <button
          type="submit"
          disabled={loading || (turnstile.required && !turnstile.token)}
          className="w-full mt-4 bg-[#073075] hover:bg-[#0a3f99] disabled:opacity-50 text-white font-bold text-sm rounded-xl py-3.5 shadow-lg hover:shadow-[0_8px_20px_-4px_rgba(7,48,117,0.4)] transition-all"
        >
          {loading ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const admin = isAdminHost();
  const brandHref = admin ? '/' : 'https://wwebconsole.com/';
  const privacyHref = admin ? 'https://wwebconsole.com/privacy' : '/privacy';
  const termsHref = admin ? 'https://wwebconsole.com/terms' : '/terms';

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-gradient-to-br from-[#073075] to-[#041a45]">
      {/* Background ambient glows covering the entire screen */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-sky-400/20 via-transparent to-transparent pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-3/4 h-3/4 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-[#0a0d14]/60 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-full max-h-2xl bg-sky-900/20 blur-[150px] pointer-events-none rounded-full" />

      {/* Left Branding Panel (Hidden on Mobile) */}
      <div className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden z-10">
        <div className="relative z-10 animate-[fadeIn_0.8s_ease-out]">
          <a href={brandHref} className="flex items-center gap-4 group inline-flex">
            <div className="flex items-center justify-center group-hover:scale-105 transition-all duration-300">
              <img src="/apexs-logo.png" alt="APEXS Logo" className="h-10 w-auto object-contain drop-shadow-md" />
            </div>
            <div>
              <h1 className="text-white font-black tracking-wider text-base uppercase drop-shadow-md">
                Weatherlink Web Console{admin ? ' Admin' : ''}
              </h1>
              <p className="text-xs text-sky-200 uppercase tracking-widest font-semibold mt-0.5">
                {admin ? 'admin.wwebconsole.com' : 'wwebconsole.com'}
              </p>
            </div>
          </a>
        </div>

        <div className="relative max-w-xl animate-[slideInUp_0.8s_ease-out]">
          <h2 className="text-5xl lg:text-6xl font-black font-display mb-6 tracking-tighter leading-[1.05] drop-shadow-lg text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-sky-300/80 pb-1">
            Your weather,<br/>beautifully visualized.
          </h2>
          <p className="text-sky-100 text-base lg:text-lg leading-relaxed max-w-md font-medium">
            Connect your Davis Instruments Vantage Pro2 or Vantage Vue and bring your local climate data to life on any screen, anywhere in the world.
          </p>
        </div>

        <div className="relative flex items-center gap-5 text-sm text-sky-200/60 font-medium">
          <span>&copy; {new Date().getFullYear()} Apexs Inc.</span>
          <a href={privacyHref} className="hover:text-white transition-colors">Privacy</a>
          <a href={termsHref} className="hover:text-white transition-colors">Terms</a>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden z-10">
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="md:hidden flex flex-col items-center mb-10 relative text-center animate-[fadeIn_0.5s_ease-out]">
          <div className="flex items-center justify-center mb-5">
            <img src="/apexs-logo.png" alt="APEXS Logo" className="h-12 w-auto object-contain drop-shadow-md" />
          </div>
          <h1 className="text-white font-black tracking-wider text-xl uppercase drop-shadow-md">
            Weatherlink Console{admin ? ' Admin' : ''}
          </h1>
        </div>

        <div className="w-full max-w-[440px] relative animate-[scaleIn_0.6s_ease-out]">
          <div className="bg-white dark:bg-[#0a0d14]/90 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 rounded-[2rem] p-8 sm:p-10 shadow-[0_30px_80px_-15px_rgba(0,0,0,0.4)] relative overflow-visible">
            <h2 className="text-slate-900 dark:text-white font-black text-3xl mb-2 tracking-tight">{title}</h2>
            <p className="text-slate-500 dark:text-gray-400 text-sm mb-8 font-medium">{subtitle}</p>
            {children}
          </div>

          <div className="md:hidden flex items-center justify-center gap-5 text-xs text-sky-200/60 mt-10 animate-[fadeIn_1s_ease-out] font-medium">
            <a href={privacyHref} className="hover:text-white transition-colors">Privacy Policy</a>
            <span>&middot;</span>
            <a href={termsHref} className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </div>
  );
}
