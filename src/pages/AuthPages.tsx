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
          theme: 'auto',
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
    <div className="mt-2 space-y-1">
      <div ref={turnstile.ref} />
      {turnstile.scriptError && (
        <p className="text-rose-400 text-xs">{turnstile.scriptError}</p>
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
          className="bg-slate-50 dark:bg-[#0a0d14] border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500/50"
        />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Password</label>
        <PasswordInput
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full bg-slate-50 dark:bg-[#0a0d14] border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500/50"
        />
        <TurnstileField enabled={authCfg.turnstileEnabled} turnstile={turnstile} />
        <button
          type="submit"
          disabled={loading || (turnstile.required && !turnstile.token)}
          className="mt-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-sm rounded-lg py-2.5"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          <Link to="/forgot-password" className="text-sky-400 hover:underline">
            Forgot password?
          </Link>
          {!isAdminHost() && (
            <>
              {' · '}
              <Link to="/register" className="text-sky-400 hover:underline">
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
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [authCfg, setAuthCfg] = useState({ turnstileEnabled: false, turnstileSiteKey: '', freeTrialDays: 30 });
  const turnstile = useTurnstile(authCfg.turnstileSiteKey, authCfg.turnstileEnabled);

  useEffect(() => {
    fetchAuthConfig().then(setAuthCfg).catch(() => undefined);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (turnstile.required && !turnstile.token) {
      setError('Complete the security check before creating an account.');
      return;
    }
    setLoading(true);
    try {
      const res = await register(email, password, name, turnstile.token || undefined);
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
      setError(err.message || 'Registration failed');
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
        {error && <p className="text-rose-400 text-xs bg-rose-950/40 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
        {info && <p className="text-emerald-400 text-xs bg-emerald-950/40 border border-emerald-500/20 rounded-lg px-3 py-2">{info}</p>}
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-slate-50 dark:bg-[#0a0d14] border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500/50"
        />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-slate-50 dark:bg-[#0a0d14] border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500/50"
        />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Password</label>
        <PasswordInput
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full bg-slate-50 dark:bg-[#0a0d14] border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500/50"
        />
        <TurnstileField enabled={authCfg.turnstileEnabled} turnstile={turnstile} />
        <button
          type="submit"
          disabled={loading || (turnstile.required && !turnstile.token)}
          className="mt-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-sm rounded-lg py-2.5"
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Already have an account?{' '}
          <Link to="/login" className="text-sky-400 hover:underline">
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
          className="bg-slate-50 dark:bg-[#0a0d14] border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500/50"
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
          className="mt-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-sm rounded-lg py-2.5"
        >
          {loading ? 'Verifying…' : 'Verify & continue'}
        </button>
        <button type="button" onClick={onResend} className="text-xs text-sky-400 hover:underline">
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
          <Link to={`/reset-password?email=${encodeURIComponent(email)}`} className="text-sky-400 hover:underline">
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
            className="bg-slate-50 dark:bg-[#0a0d14] border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500/50"
          />
          <TurnstileField enabled={authCfg.turnstileEnabled} turnstile={turnstile} />
          <button
            type="submit"
            disabled={loading || (turnstile.required && !turnstile.token)}
            className="mt-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-sm rounded-lg py-2.5"
          >
            {loading ? 'Sending…' : 'Send reset code'}
          </button>
          <Link to="/login" className="text-xs text-sky-400 hover:underline text-center">
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
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-slate-50 dark:bg-[#0a0d14] border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500/50" />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Code</label>
        <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} className="bg-slate-50 dark:bg-[#0a0d14] border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white font-mono outline-none focus:border-sky-500/50" />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">New password</label>
        <PasswordInput
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full bg-slate-50 dark:bg-[#0a0d14] border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500/50"
        />
        <TurnstileField enabled={authCfg.turnstileEnabled} turnstile={turnstile} />
        <button
          type="submit"
          disabled={loading || (turnstile.required && !turnstile.token)}
          className="mt-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-sm rounded-lg py-2.5"
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
    <div className="min-h-screen bg-[#e8edf3] dark:bg-[#0a0d14] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <a href={brandHref} className="flex items-center gap-3 mb-8 group">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-500/25 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-slate-900 dark:text-white font-black tracking-wider text-sm uppercase group-hover:text-sky-600 dark:group-hover:text-sky-400">
              Weatherlink Web Console{admin ? ' Admin' : ''}
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">
              {admin ? 'admin.wwebconsole.com' : 'wwebconsole.com'}
            </p>
          </div>
        </a>
        <div className="bg-white dark:bg-[#0e111a] border border-slate-200 dark:border-[#2d343f] rounded-2xl p-6 shadow-xl">
          <h2 className="text-slate-900 dark:text-white font-bold text-lg">{title}</h2>
          <p className="text-slate-500 dark:text-gray-400 text-xs mt-1 mb-5">{subtitle}</p>
          {children}
        </div>
        <p className="text-[11px] text-slate-500 text-center mt-4">
          <a href={privacyHref} className="hover:underline">
            Privacy
          </a>
          {' · '}
          <a href={termsHref} className="hover:underline">
            Terms
          </a>
        </p>
      </div>
    </div>
  );
}
