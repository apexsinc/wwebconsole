import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Network,
  Save,
  HelpCircle,
  Settings,
  Activity,
  LogOut,
  Link2,
  Copy,
  Trash2,
  Plus,
  UserRound,
  Moon,
  Sun,
  ExternalLink,
} from 'lucide-react';
import { useWeatherStore } from '../store.js';
import {
  buildStationPatch,
  createShareLink,
  deleteShareLink,
  logout,
  useConfigMutation,
  useShareLinks,
} from '../services/api.js';
import { useTheme } from '../hooks/useTheme.js';
import { PasswordInput } from './PasswordInput.js';

export default function ConfigNavbar() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const config = useWeatherStore((state) => state.config);
  const connection = useWeatherStore((state) => state.connection);
  const user = useWeatherStore((state) => state.user);
  const setUser = useWeatherStore((state) => state.setUser);
  const configMutation = useConfigMutation();
  const shareQuery = useShareLinks();

  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'link' | 'tv'>('link');

  const [apiVersion, setApiVersion] = useState<'v1' | 'v2'>(config.cloudApiVersion ?? 'v2');
  const [did, setDid] = useState(config.cloudDid ?? '');
  const [password, setPassword] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [stationId, setStationId] = useState(config.cloudStationId ?? '');
  const [shareLabel, setShareLabel] = useState('Lobby TV');
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [configError, setConfigError] = useState('');
  const [shareError, setShareError] = useState('');
  const billing = useWeatherStore((s) => s.billing);

  useEffect(() => {
    setApiVersion(config.cloudApiVersion ?? 'v2');
    setDid(config.cloudDid ?? '');
    setStationId(config.cloudStationId ?? '');
  }, [config]);

  const handleSave = () => {
    setConfigError('');
    const patch = buildStationPatch({
      apiVersion,
      did,
      password: apiVersion === 'v1' ? password : password,
      apiToken,
      apiSecret: apiVersion === 'v2' ? apiSecret : '',
      stationId: apiVersion === 'v2' ? stationId : '',
      latitude: '',
      longitude: '',
    });
    if (apiVersion === 'v1') {
      patch.cloudApiSecret = '';
    }
    configMutation.mutate(patch, {
      onSuccess: () => {
        setPassword('');
        setApiToken('');
        setApiSecret('');
        setConfigError('');
        setIsOpen(false);
      },
      onError: (err: any) => {
        setConfigError(err.message || 'Failed to save configuration');
      },
    });
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    navigate('/login');
  };

  const handleCreateShare = async () => {
    if (!config.hasApiToken && !config.hasPassword) {
      setShareError('Please configure your WeatherLink API credentials first.');
      return;
    }
    setShareError('');
    setShareBusy(true);
    try {
      await createShareLink(shareLabel);
      await shareQuery.refetch();
    } catch (err: any) {
      setShareError(err.message || 'Failed to create share link');
    } finally {
      setShareBusy(false);
    }
  };

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleDeleteShare = async (id: string) => {
    await deleteShareLink(id);
    await shareQuery.refetch();
  };

  /* ─── shared input className ─── */
  const inputCls =
    'bg-slate-800/80 border border-slate-600/60 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 rounded-lg px-3 py-2.5 text-white placeholder:text-slate-500 text-sm focus:outline-none transition-all w-full';
  const monoInputCls = inputCls + ' font-mono';
  const labelCls = 'text-xs text-slate-200 uppercase tracking-wider font-bold';

  return (
    <>
      <nav id="config-navbar" className="w-full bg-slate-900 dark:bg-[#0a0d14] border-b border-slate-800 px-6 py-4 flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <img src="/apexs-logo.png" alt="APEXS Logo" className="h-9 w-auto object-contain" />
          <div>
            <h1 className="text-white font-sans font-black tracking-wider text-sm md:text-base uppercase leading-none">
              Weatherlink Web Console
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connection.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest font-semibold">
                {user?.email || 'guest'} · {connection.status}
              </span>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center absolute left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-mono border px-3 py-1 rounded-full font-bold uppercase tracking-wider text-sky-400 bg-sky-950/40 border-sky-500/25">
            <Network className="w-3.5 h-3.5" />
            WeatherLink Cloud · {config.cloudApiVersion?.toUpperCase() || 'V2'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white rounded-lg"
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-sky-300" />}
          </button>
          <button
            onClick={() => navigate('/account')}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white rounded-lg"
          >
            <UserRound className="w-3.5 h-3.5 text-sky-400" />
            Account
          </button>
          <button
            onClick={() => {
              setTab('tv');
              setIsOpen(true);
            }}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white rounded-lg"
          >
            <Link2 className="w-3.5 h-3.5 text-sky-400" />
            TV Share
          </button>
          <button
            onClick={() => {
              setTab('link');
              setIsOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 text-xs font-semibold bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white rounded-lg"
          >
            <Settings className="w-3.5 h-3.5 text-gray-400" />
            Configure
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-gray-950 hover:bg-gray-900 border border-gray-800 text-gray-300 rounded-lg"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-800/50 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-sky-400" />
                <h2 className="text-white font-sans font-bold text-lg tracking-tight">Console Settings</h2>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4 flex gap-2">
              <button
                onClick={() => setTab('link')}
                className={`px-4 py-2 text-sm font-bold rounded-lg border transition-all ${
                  tab === 'link'
                    ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                    : 'border-white/10 text-slate-300 hover:text-white hover:border-white/20'
                }`}
              >
                WeatherLink
              </button>
              <button
                onClick={() => setTab('tv')}
                className={`px-4 py-2 text-sm font-bold rounded-lg border transition-all ${
                  tab === 'tv'
                    ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                    : 'border-white/10 text-slate-300 hover:text-white hover:border-white/20'
                }`}
              >
                TV Broadcast URL
              </button>
            </div>

            {/* ── WeatherLink Tab ── */}
            {tab === 'link' ? (
              <>
                <div className="p-6 flex flex-col gap-5 max-h-[60vh] overflow-y-auto relative">
                  {/* Fake inputs to absorb aggressive browser autofill */}
                  <input type="text" name="dummy-email" className="absolute top-[-9999px] opacity-0" tabIndex={-1} aria-hidden="true" />
                  <input type="password" name="dummy-password" className="absolute top-[-9999px] opacity-0" tabIndex={-1} aria-hidden="true" />

                  {/* Info banner */}
                  <p className="text-sm text-amber-300/90 bg-amber-950/30 border border-amber-500/30 rounded-lg px-4 py-3 leading-relaxed">
                    Connect with WeatherLink Cloud credentials. Local network / UDP discovery is not available in this console.
                  </p>

                  {configError && (
                    <div className="bg-rose-500/15 border border-rose-500/30 rounded-lg px-4 py-3 text-rose-300 text-sm font-semibold">
                      {configError}
                    </div>
                  )}

                  {/* Credentials card */}
                  <div className="bg-slate-900/60 border border-white/15 rounded-xl p-4 flex flex-col gap-4">

                    {/* API version toggle */}
                    <div className="flex bg-slate-950/70 border border-white/10 rounded-lg p-1">
                      <button
                        type="button"
                        onClick={() => { setApiVersion('v1'); setApiSecret(''); }}
                        className={`flex-1 py-2.5 rounded-md text-sm font-bold transition-all ${
                          apiVersion === 'v1'
                            ? 'bg-sky-500/20 border border-sky-500/40 text-sky-300'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        API V1
                      </button>
                      <button
                        type="button"
                        onClick={() => setApiVersion('v2')}
                        className={`flex-1 py-2.5 rounded-md text-sm font-bold transition-all ${
                          apiVersion === 'v2'
                            ? 'bg-sky-500/20 border border-sky-500/40 text-sky-300'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        API V2
                      </button>
                    </div>
                    <p className="text-xs text-amber-300/80 leading-relaxed">
                      V1: DID + password + API token.&nbsp;&nbsp;V2: API key + secret (password optional).
                    </p>

                    {/* Device ID — always shown */}
                    <div className="flex flex-col gap-1.5">
                      <label className={labelCls}>Device ID (DID)</label>
                      <input
                        type="text"
                        value={did}
                        onChange={(e) => setDid(e.target.value)}
                        placeholder="e.g. 001D0A00DE6A"
                        autoComplete="off"
                        className={monoInputCls}
                      />
                    </div>

                    {apiVersion === 'v1' ? (
                      <>
                        {/* V1: Password */}
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>
                            Account Password
                            {config.hasPassword && (
                              <span className="ml-2 text-emerald-400 normal-case font-normal text-[10px]">✓ saved — leave blank to keep</span>
                            )}
                          </label>
                          <PasswordInput
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            placeholder={config.hasPassword ? 'Leave blank to keep current' : 'Enter WeatherLink password'}
                            className={inputCls}
                          />
                        </div>

                        {/* V1: API Token */}
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>
                            API Token
                            {config.hasApiToken && (
                              <span className="ml-2 text-emerald-400 normal-case font-normal text-[10px]">✓ saved — leave blank to keep</span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={apiToken}
                            onChange={(e) => setApiToken(e.target.value)}
                            placeholder={config.hasApiToken ? 'Leave blank to keep current' : 'Paste your API token here'}
                            autoComplete="off"
                            className={monoInputCls}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {/* V2: API Key */}
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>
                            API Key
                            {config.hasApiToken && (
                              <span className="ml-2 text-emerald-400 normal-case font-normal text-[10px]">✓ saved — leave blank to keep</span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={apiToken}
                            onChange={(e) => setApiToken(e.target.value)}
                            placeholder={config.hasApiToken ? 'Leave blank to keep current' : 'Paste your V2 API key here'}
                            autoComplete="off"
                            className={monoInputCls}
                          />
                        </div>

                        {/* V2: API Secret */}
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>
                            API Secret
                            {config.hasApiSecret && (
                              <span className="ml-2 text-emerald-400 normal-case font-normal text-[10px]">✓ saved — leave blank to keep</span>
                            )}
                          </label>
                          <PasswordInput
                            value={apiSecret}
                            onChange={(e) => setApiSecret(e.target.value)}
                            autoComplete="new-password"
                            placeholder={config.hasApiSecret ? 'Leave blank to keep current' : 'Paste your V2 API secret here'}
                            className={inputCls}
                          />
                        </div>

                        {/* V2: Station ID */}
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>
                            Station ID
                            <span className="ml-2 text-slate-400 normal-case font-normal text-[10px]">optional — auto-detected</span>
                          </label>
                          <input
                            type="text"
                            value={stationId}
                            onChange={(e) => setStationId(e.target.value)}
                            placeholder="Auto-detected from your account"
                            autoComplete="off"
                            className={monoInputCls}
                          />
                        </div>

                        {/* V2: Password (optional) */}
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>
                            Password
                            <span className="ml-2 text-slate-400 normal-case font-normal text-[10px]">optional — for sunrise/sunset</span>
                            {config.hasPassword && (
                              <span className="ml-2 text-emerald-400 normal-case font-normal text-[10px]">✓ saved</span>
                            )}
                          </label>
                          <PasswordInput
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            placeholder={config.hasPassword ? 'Leave blank to keep current' : 'WeatherLink account password'}
                            className={inputCls}
                          />
                        </div>
                      </>
                    )}

                    <p className="text-xs text-slate-400 leading-relaxed flex items-start gap-1.5">
                      <HelpCircle className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
                      Credentials stay private to your account. Secrets are never shown again after you save.
                    </p>
                  </div>

                  {/* Plan & polling card */}
                  <div className="bg-slate-900/60 border border-white/15 rounded-xl p-5 flex flex-col gap-3">
                    <h3 className="text-base font-bold text-white">WeatherLink plan & polling</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Plan and poll interval are set from your WeatherLink subscription and WWebConsole billing. Contact support or an admin to change Pro access.
                    </p>
                    <p className="text-sm font-mono text-slate-200 uppercase bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2.5">
                      Plan: <span className="text-sky-300">{config.wlPlan || 'unknown'}</span>
                    </p>
                    {billing && (
                      <p className="text-sm text-slate-300 font-mono bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2.5">
                        Access: <span className="text-emerald-300">{billing.subscriptionStatus}</span>
                        {billing.freeUntil != null ? (
                          <span className="text-amber-300"> · free until {new Date(billing.freeUntil).toLocaleDateString()}</span>
                        ) : null}
                        {' · '}poll <span className="text-sky-300">{billing.pollIntervalSec}s</span>
                      </p>
                    )}
                  </div>

                  {/* Location card */}
                  <div className="bg-slate-900/60 border border-white/15 rounded-xl p-5 flex flex-col gap-3">
                    <h3 className="text-base font-bold text-white">
                      Station location <span className="text-slate-400 font-normal text-sm">(auto from WeatherLink)</span>
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Latitude, longitude, and timezone are pulled from the WeatherLink Cloud station profile on each refresh — no manual entry needed for sunrise/sunset.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2.5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Latitude</p>
                        <p className="text-sm text-white font-mono mt-1">
                          {config.latitude != null ? Number(config.latitude).toFixed(5) : <span className="text-slate-500">—</span>}
                        </p>
                      </div>
                      <div className="bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2.5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Longitude</p>
                        <p className="text-sm text-white font-mono mt-1">
                          {config.longitude != null ? Number(config.longitude).toFixed(5) : <span className="text-slate-500">—</span>}
                        </p>
                      </div>
                      <div className="bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2.5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Timezone</p>
                        <p className="text-xs text-white font-mono mt-1 truncate" title={config.timezone || ''}>
                          {config.timezone || <span className="text-slate-500">—</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-white/10 bg-slate-900/30 flex items-center justify-end gap-3">
                  <button onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={configMutation.isPending}
                    className="px-5 py-2.5 text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    {configMutation.isPending ? 'Saving…' : 'Apply Config'}
                  </button>
                </div>
              </>
            ) : (
              /* ── TV Tab ── */
              <div className="p-6 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
                <p className="text-sm text-slate-200 leading-relaxed">
                  Create a public URL for big-screen TVs. Anyone with the link can view live weather — no login required.
                </p>

                {shareError && (
                  <div className="bg-rose-500/15 border border-rose-500/30 rounded-lg px-4 py-3 text-rose-300 text-sm font-semibold">
                    {shareError}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    value={shareLabel}
                    onChange={(e) => setShareLabel(e.target.value)}
                    placeholder="Label, e.g. Lobby TV"
                    className="flex-1 bg-slate-800/80 border border-slate-600/60 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 rounded-lg px-3 py-2.5 text-white placeholder:text-slate-500 text-sm focus:outline-none transition-all"
                  />
                  <button
                    onClick={handleCreateShare}
                    disabled={shareBusy}
                    className="px-4 py-2.5 text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Create
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {(shareQuery.data?.links || []).map((link) => (
                    <div
                      key={link.id}
                      className="bg-slate-900/40 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white font-semibold truncate">{link.label}</p>
                        <p className="text-xs text-sky-400 font-mono truncate">{link.url}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => window.open(link.url, '_blank')}
                          className="p-2 rounded-lg hover:bg-slate-800/60 text-slate-300 hover:text-sky-400 transition-colors"
                          title="Preview"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopy(link.url)}
                          className="p-2 rounded-lg hover:bg-slate-800/60 text-slate-300 hover:text-white transition-colors"
                          title="Copy"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteShare(link.id)}
                          className="p-2 rounded-lg hover:bg-slate-800/60 text-slate-300 hover:text-rose-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!shareQuery.data?.links?.length && (
                    <p className="text-xs text-slate-400 text-center py-6">No TV links yet. Create one to broadcast.</p>
                  )}
                  {copied && <p className="text-xs text-emerald-400 text-center">Copied to clipboard ✓</p>}
                </div>

                <div className="pt-4 flex justify-end">
                  <button onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white rounded-lg transition-colors">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
