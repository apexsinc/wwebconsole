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
    // Exclusive credential sets: only send fields for the selected API version
    const patch = buildStationPatch({
      apiVersion,
      did,
      password: apiVersion === 'v1' ? password : password, // v2 optional hybrid password ok
      apiToken,
      apiSecret: apiVersion === 'v2' ? apiSecret : '',
      stationId: apiVersion === 'v2' ? stationId : '',
      latitude: '',
      longitude: '',
    });
    // Force clear opposite-version secrets on the server
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
      }
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

  return (
    <>
      <nav id="config-navbar" className="w-full bg-slate-900 dark:bg-[#0a0d14] border-b border-slate-800 px-6 py-4 flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-950/40 border border-sky-500/25 flex items-center justify-center text-sky-400">
            <Activity className="w-4.5 h-4.5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-white font-sans font-black tracking-wider text-xs md:text-sm uppercase leading-none">
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

        <div className="hidden sm:flex items-center">
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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0e111a] border border-gray-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-900 bg-gray-950/40">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-sky-400" />
                <h2 className="text-white font-sans font-bold text-base tracking-tight">Console Settings</h2>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-gray-900">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="px-6 pt-4 flex gap-2">
              <button
                onClick={() => setTab('link')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${
                  tab === 'link' ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'border-gray-800 text-gray-400'
                }`}
              >
                WeatherLink
              </button>
              <button
                onClick={() => setTab('tv')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${
                  tab === 'tv' ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'border-gray-800 text-gray-400'
                }`}
              >
                TV Broadcast URL
              </button>
            </div>

            {tab === 'link' ? (
              <>
                <div className="p-6 flex flex-col gap-5 max-h-[60vh] overflow-y-auto">
                  <p className="text-[10px] text-amber-400/90 bg-amber-950/20 border border-amber-500/20 rounded-lg px-3 py-2">
                    Connect with WeatherLink Cloud credentials. Local network / UDP discovery is not available in this
                    console.
                  </p>

                  {configError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 text-rose-400 text-xs">
                      {configError}
                    </div>
                  )}

                  <div className="bg-gray-950/40 border border-gray-900/60 rounded-xl p-4 flex flex-col gap-4">
                  <div className="flex bg-gray-950 border border-gray-800 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setApiVersion('v1');
                        setApiSecret('');
                      }}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-bold ${
                        apiVersion === 'v1' ? 'bg-gray-800 text-white' : 'text-gray-500'
                      }`}
                    >
                      API V1 only
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setApiVersion('v2');
                      }}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-bold ${
                        apiVersion === 'v2' ? 'bg-gray-800 text-white' : 'text-gray-500'
                      }`}
                    >
                      API V2 only
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-400/90">
                    Choose one API version. V1 uses DID + password + token. V2 uses API key + secret (password optional).
                  </p>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Device ID (DID)</label>
                      <input
                        type="text"
                        value={did}
                        onChange={(e) => setDid(e.target.value)}
                        placeholder="e.g. 001D0A00DE6A"
                        className="bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none"
                      />
                    </div>

                    {apiVersion === 'v1' ? (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                            Account Password {config.hasPassword ? '(saved — leave blank to keep)' : ''}
                          </label>
                          <PasswordInput
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="off"
                            className="w-full bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                            API Token {config.hasApiToken ? '(saved — leave blank to keep)' : ''}
                          </label>
                          <input
                            type="text"
                            value={apiToken}
                            onChange={(e) => setApiToken(e.target.value)}
                            className="bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                            API Key {config.hasApiToken ? '(saved — leave blank to keep)' : ''}
                          </label>
                          <input
                            type="text"
                            value={apiToken}
                            onChange={(e) => setApiToken(e.target.value)}
                            className="bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                            API Secret {config.hasApiSecret ? '(saved — leave blank to keep)' : ''}
                          </label>
                          <PasswordInput
                            value={apiSecret}
                            onChange={(e) => setApiSecret(e.target.value)}
                            autoComplete="off"
                            className="w-full bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                            Station ID (optional — auto-detected)
                          </label>
                          <input
                            type="text"
                            value={stationId}
                            onChange={(e) => setStationId(e.target.value)}
                            className="bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                            Password (optional for sunrise/sunset)
                          </label>
                          <PasswordInput
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="off"
                            className="w-full bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                          />
                        </div>
                      </>
                    )}

                    <p className="text-gray-500 text-[10px] leading-relaxed flex items-start gap-1">
                      <HelpCircle className="w-3.5 h-3.5 shrink-0 text-gray-600 mt-0.5" />
                      Credentials stay private to your account. Secrets are never shown again after you save.
                    </p>
                  </div>

                  <div className="bg-gray-950/40 border border-gray-900/60 rounded-xl p-4 flex flex-col gap-3">
                    <h3 className="text-sm font-bold text-white">WeatherLink plan & polling</h3>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      Plan and poll interval are set from your WeatherLink subscription and WWebConsole billing. Contact
                      support or an admin to change Pro access.
                    </p>
                    <p className="text-xs font-mono text-gray-300 uppercase">
                      Plan: {config.wlPlan || 'unknown'}
                    </p>
                    {billing && (
                      <p className="text-[10px] text-gray-400 font-mono">
                        Access: {billing.subscriptionStatus}
                        {billing.freeUntil ? ` · free until ${new Date(billing.freeUntil).toLocaleDateString()}` : ''}
                        {' · '}poll {billing.pollIntervalSec}s
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-950/40 border border-gray-900/60 rounded-xl p-4 flex flex-col gap-2">
                    <h3 className="text-sm font-bold text-white">Station location (auto from WeatherLink)</h3>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      Latitude, longitude, and timezone are pulled from the WeatherLink Cloud station profile on each refresh — no manual entry needed for sunrise/sunset.
                    </p>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <div className="bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Latitude</p>
                        <p className="text-xs text-white font-mono mt-0.5">
                          {config.latitude != null ? Number(config.latitude).toFixed(5) : '—'}
                        </p>
                      </div>
                      <div className="bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Longitude</p>
                        <p className="text-xs text-white font-mono mt-0.5">
                          {config.longitude != null ? Number(config.longitude).toFixed(5) : '—'}
                        </p>
                      </div>
                      <div className="bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Timezone</p>
                        <p className="text-[10px] text-white font-mono mt-0.5 truncate" title={config.timezone || ''}>
                          {config.timezone || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-900 bg-gray-950/40 flex items-center justify-end gap-2.5">
                  <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-lg">
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={configMutation.isPending}
                    className="px-4 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {configMutation.isPending ? 'Saving…' : 'Apply Config'}
                  </button>
                </div>
              </>
            ) : (
              <div className="p-6 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
                <p className="text-xs text-gray-400">
                  Create a public URL for big-screen TVs. Anyone with the link can view live weather — no login required.
                </p>
                
                {shareError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 text-rose-400 text-xs">
                    {shareError}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    value={shareLabel}
                    onChange={(e) => setShareLabel(e.target.value)}
                    placeholder="Label"
                    className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white text-xs focus:border-sky-500 focus:outline-none"
                  />
                  <button
                    onClick={handleCreateShare}
                    disabled={shareBusy}
                    className="px-3 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {(shareQuery.data?.links || []).map((link) => (
                    <div
                      key={link.id}
                      className="bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-white font-semibold truncate">{link.label}</p>
                        <p className="text-[10px] text-sky-400 font-mono truncate">{link.url}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopy(link.url)}
                          className="p-1.5 rounded-lg hover:bg-gray-900 text-gray-400 hover:text-white"
                          title="Copy"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteShare(link.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-900 text-gray-400 hover:text-rose-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!shareQuery.data?.links?.length && (
                    <p className="text-[11px] text-gray-500 text-center py-4">No TV links yet. Create one to broadcast.</p>
                  )}
                  {copied && <p className="text-[10px] text-emerald-400 text-center">Copied to clipboard</p>}
                </div>

                <div className="px-0 pt-2 flex justify-end">
                  <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-lg">
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
