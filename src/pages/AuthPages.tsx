import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { login, register } from '../services/api.js';
import { useWeatherStore } from '../store.js';

export function LoginPage() {
  const navigate = useNavigate();
  const setUser = useWeatherStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user } = await login(email, password);
      setUser(user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Sign in" subtitle="Open your WeatherLink console">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {error && <p className="text-rose-400 text-xs bg-rose-950/40 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-[#0a0d14] border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/50"
        />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-[#0a0d14] border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/50"
        />
        <button
          type="submit"
          disabled={loading}
          className="mt-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-sm rounded-lg py-2.5"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          No account?{' '}
          <Link to="/register" className="text-sky-400 hover:underline">
            Create one
          </Link>
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
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user } = await register(email, password, name);
      setUser(user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create account" subtitle="Connect WeatherLink Cloud and share a TV URL">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {error && <p className="text-rose-400 text-xs bg-rose-950/40 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-[#0a0d14] border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/50"
        />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-[#0a0d14] border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/50"
        />
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-[#0a0d14] border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/50"
        />
        <button
          type="submit"
          disabled={loading}
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

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0d14] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-sky-950/40 border border-sky-500/25 flex items-center justify-center text-sky-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-white font-black tracking-wider text-sm uppercase">WWebConsole</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">wwebconsole.com</p>
          </div>
        </div>
        <div className="bg-[#0e111a] border border-[#2d343f] rounded-2xl p-6 shadow-2xl">
          <h2 className="text-white font-bold text-lg">{title}</h2>
          <p className="text-gray-400 text-xs mt-1 mb-5">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
