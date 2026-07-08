import { useState } from 'react';
import { X, Network, Wifi, Save, HelpCircle, Server, Settings, Activity } from 'lucide-react';
import { useWeatherStore } from '../store.js';
import { useConfigMutation } from '../services/api.js';

export default function ConfigNavbar() {
  const config = useWeatherStore((state) => state.config);
  const connection = useWeatherStore((state) => state.connection);
  const configMutation = useConfigMutation();

  const [isOpen, setIsOpen] = useState(false);

  // Connection settings states
  const [ipAddress, setIpAddress] = useState(config.wllIpAddress);
  const [useCloud, setUseCloud] = useState(config.useCloudApi ?? false);
  const [apiVersion, setApiVersion] = useState<'v1' | 'v2'>(config.cloudApiVersion ?? 'v1');
  const [did, setDid] = useState(config.cloudDid ?? '');
  const [password, setPassword] = useState(config.cloudPassword ?? '');
  const [apiToken, setApiToken] = useState(config.cloudApiToken ?? '');
  const [apiSecret, setApiSecret] = useState(config.cloudApiSecret ?? '');
  const [stationId, setStationId] = useState(config.cloudStationId ?? '');

  const handleSave = () => {
    configMutation.mutate({
      ...config,
      wllIpAddress: ipAddress,
      useCloudApi: useCloud,
      cloudApiVersion: apiVersion,
      cloudDid: did,
      cloudPassword: password,
      cloudApiToken: apiToken,
      cloudApiSecret: apiSecret,
      cloudStationId: stationId
    }, {
      onSuccess: () => {
        setIsOpen(false);
      }
    });
  };

  const getSourceBadge = () => {
    if (config.useCloudApi) {
      return { label: 'WeatherLink Cloud', color: 'text-sky-400 bg-sky-950/40 border-sky-500/25', icon: Network };
    }
    return { 
      label: config.wllIpAddress ? `Local LAN (${config.wllIpAddress})` : 'Unconfigured Link', 
      color: config.wllIpAddress ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/25' : 'text-gray-400 bg-gray-950/40 border-gray-800', 
      icon: Server 
    };
  };

  const badge = getSourceBadge();
  const BadgeIcon = badge.icon;

  return (
    <>
      <nav className="w-full bg-[#0a0d14] border-b border-gray-900 px-6 py-4 flex items-center justify-between select-none">
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-950/40 border border-sky-500/25 flex items-center justify-center text-sky-400">
            <Activity className="w-4.5 h-4.5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-white font-sans font-black tracking-wider text-xs md:text-sm uppercase leading-none">
              WeatherLink Web Console
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                connection.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'
              }`} />
              <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest font-semibold">
                Link Status: {connection.status}
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Active Source Info Badge */}
        <div className="hidden sm:flex items-center">
          <div className={`flex items-center gap-1.5 text-[10px] md:text-xs font-mono border px-3 py-1 rounded-full font-bold uppercase tracking-wider ${badge.color}`}>
            <BadgeIcon className="w-3.5 h-3.5" />
            {badge.label}
          </div>
        </div>

        {/* Right: Settings Action Button */}
        <div>
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 text-xs font-semibold bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white rounded-lg transition-all cursor-pointer active:scale-95 focus:outline-none"
          >
            <Settings className="w-3.5 h-3.5 text-gray-400" />
            Configure Web Link
          </button>
        </div>
      </nav>

      {/* Web Configuration Settings Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0e111a] border border-gray-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-900 bg-gray-950/40">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-sky-400" />
                <h2 className="text-white font-sans font-bold text-base tracking-tight">
                  Console Web Link Configuration
                </h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-white transition-all cursor-pointer p-1 rounded-lg hover:bg-gray-900 focus:outline-none"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col gap-5 select-none max-h-[60vh] overflow-y-auto custom-scrollbar">
              
              {/* Data Source Selector */}
              <div className="bg-gray-950/40 border border-gray-900/60 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-950/30 border border-sky-500/20 flex items-center justify-center text-sky-400">
                    <Wifi className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-none">Console Data Source</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">Select where the console gets its weather readings</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setUseCloud(false)}
                    className={`py-2 px-1 rounded-lg text-[10px] md:text-xs font-semibold border transition-all cursor-pointer ${
                      !useCloud
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400 font-bold'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    Local LAN (WLL)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseCloud(true)}
                    className={`py-2 px-1 rounded-lg text-[10px] md:text-xs font-semibold border transition-all cursor-pointer ${
                      useCloud
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400 font-bold'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    WeatherLink Cloud
                  </button>
                </div>
              </div>

              {/* Local LAN IP Input Panel */}
              {!useCloud && (
                <div className="bg-gray-950/40 border border-gray-900/60 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-950/30 border border-sky-500/20 flex items-center justify-center text-sky-400">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white leading-none">WeatherLink Live IP Address</h3>
                      <p className="text-[10px] text-gray-500 mt-0.5">Local network device coordinates</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      placeholder="e.g. 192.168.1.100"
                      className="flex-1 bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none transition-all"
                    />
                  </div>
                  <p className="text-gray-500 text-[10px] leading-relaxed flex items-start gap-1">
                    <HelpCircle className="w-3.5 h-3.5 shrink-0 text-gray-600 mt-0.5" />
                    The console queries current conditions via the HTTP API, and the local Node backend listens for UDP broadcast telemetry packets on port 22222.
                  </p>
                </div>
              )}

              {/* WeatherLink Cloud API Credentials Panel */}
              {useCloud && (
                <div className="bg-gray-950/40 border border-gray-900/60 rounded-xl p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-950/30 border border-sky-500/20 flex items-center justify-center text-sky-400">
                      <Network className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white leading-none">WeatherLink Cloud Credentials</h3>
                      <p className="text-[10px] text-gray-500 mt-0.5">Required authentication parameters</p>
                    </div>
                  </div>

                  {/* API Version Selector */}
                  <div className="flex bg-gray-950 border border-gray-800 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setApiVersion('v1')}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-bold tracking-wider transition-all ${
                        apiVersion === 'v1' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      API V1 (Legacy)
                    </button>
                    <button
                      type="button"
                      onClick={() => setApiVersion('v2')}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-bold tracking-wider transition-all ${
                        apiVersion === 'v2' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      API V2 (Modern)
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Device ID (DID)</label>
                      <input
                        type="text"
                        value={did}
                        onChange={(e) => setDid(e.target.value)}
                        placeholder="e.g. 001D0A00DE6A"
                        className="bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none transition-all"
                      />
                    </div>

                    {apiVersion === 'v1' ? (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Account Password</label>
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Account Password"
                            className="bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-lg px-3 py-2 text-white font-sans text-xs focus:outline-none transition-all"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">API Token v1</label>
                          <input
                            type="text"
                            value={apiToken}
                            onChange={(e) => setApiToken(e.target.value)}
                            placeholder="API Token ID"
                            className="bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none transition-all"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">API Key v2</label>
                          <input
                            type="text"
                            value={apiToken}
                            onChange={(e) => setApiToken(e.target.value)}
                            placeholder="API Key"
                            className="bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none transition-all"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">API Secret v2</label>
                          <input
                            type="password"
                            value={apiSecret}
                            onChange={(e) => setApiSecret(e.target.value)}
                            placeholder="API Secret"
                            className="bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-lg px-3 py-2 text-white font-sans text-xs focus:outline-none transition-all"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <p className="text-gray-500 text-[10px] leading-relaxed flex items-start gap-1">
                    <HelpCircle className="w-3.5 h-3.5 shrink-0 text-gray-600 mt-0.5" />
                    {apiVersion === 'v1' 
                      ? 'Data is pulled from api.weatherlink.com/v1/NoaaExt.json. Best for EnviroMonitor.'
                      : 'Data is pulled from api.weatherlink.com/v2. Best for WeatherLink Live.'} A poll interval of 1 minute is applied.
                  </p>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-900 bg-gray-950/40 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-all cursor-pointer rounded-lg hover:bg-gray-900 focus:outline-none"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={configMutation.isPending}
                className="px-4 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white rounded-lg transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 focus:outline-none disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {configMutation.isPending ? 'Saving...' : 'Apply Config'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
