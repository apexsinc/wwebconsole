/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { X, Network, Cpu, Wifi, Save, HelpCircle, Server } from 'lucide-react';
import { useWeatherStore } from '../store.js';
import { useConfigMutation } from '../services/api.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const config = useWeatherStore((state) => state.config);
  const connection = useWeatherStore((state) => state.connection);
  
  const [ipAddress, setIpAddress] = useState(config.wllIpAddress);
  const [isSim, setIsSim] = useState(config.isSimulationMode);
  
  const configMutation = useConfigMutation();

  if (!isOpen) return null;

  const handleSave = () => {
    configMutation.mutate({
      wllIpAddress: ipAddress,
      isSimulationMode: isSim
    }, {
      onSuccess: () => {
        onClose();
      }
    });
  };

  return (
    <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      {/* Settings Dialog Container */}
      <div className="w-full max-w-lg bg-[#0e111a] border border-gray-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-900 bg-gray-950/40">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-sky-400" />
            <h2 className="text-white font-sans font-bold text-base tracking-tight">
              Davis Console Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-all cursor-pointer p-1 rounded-lg hover:bg-gray-900 focus:outline-none"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-5 select-none">
          
          {/* Simulation Toggle Option */}
          <div className="bg-gray-950/40 border border-gray-900/60 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-950/30 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-none">Simulation Mode</h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">Fluctuates weather values dynamically</p>
                </div>
              </div>

              {/* Slider switch */}
              <button
                onClick={() => setIsSim(!isSim)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isSim ? 'bg-sky-500' : 'bg-gray-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isSim ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            
            <p className="text-gray-400 text-xs leading-relaxed">
              When enabled, the dashboard displays realistic, drifting, and responsive mock measurements modeled exactly after real Davis weather telemetry. Disable this to link to a physical console device.
            </p>
          </div>

          {/* Network IP Input Panel */}
          <div className={`bg-gray-950/40 border rounded-xl p-4 flex flex-col gap-3 transition-all duration-300 ${
            isSim ? 'opacity-45 border-gray-950' : 'opacity-100 border-gray-900/60'
          }`}>
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
                disabled={isSim}
                placeholder="e.g. 192.168.1.100"
                className="flex-1 bg-gray-950 border border-gray-800 focus:border-sky-500 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none transition-all disabled:opacity-50"
              />
            </div>
            <p className="text-gray-500 text-[10px] leading-relaxed flex items-start gap-1">
              <HelpCircle className="w-3.5 h-3.5 shrink-0 text-gray-600 mt-0.5" />
              We fetch current conditions directly via the HTTP API, and the local Node backend listens for UDP broadcast telemetry packets on port 22222.
            </p>
          </div>

          {/* System Connection Status Readout Panel */}
          <div className="bg-gray-950/30 border border-gray-900 rounded-xl p-4 flex flex-col gap-2.5 font-mono text-[10px]">
            <div className="flex items-center justify-between pb-1 border-b border-gray-900">
              <span className="text-gray-400 font-bold uppercase tracking-wider">Telemetry Diagnostics</span>
              <span className={`px-2 py-0.5 rounded-full uppercase font-bold text-[8px] ${
                connection.status === 'online' 
                  ? 'bg-emerald-950/40 border border-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-950/40 border border-rose-500/20 text-rose-400'
              }`}>
                {connection.status}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">UDP Broadcast (Port 22222):</span>
              <span className={connection.lastUdpReceived ? 'text-sky-400' : 'text-gray-600'}>
                {connection.lastUdpReceived 
                  ? `${Math.round((Date.now() - connection.lastUdpReceived) / 1000)}s ago` 
                  : 'No Packet Heard'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">HTTP Poll Fallback:</span>
              <span className={connection.lastHttpReceived ? 'text-emerald-400' : 'text-gray-600'}>
                {connection.lastHttpReceived 
                  ? `${Math.round((Date.now() - connection.lastHttpReceived) / 1000)}s ago` 
                  : 'Never Polled'}
              </span>
            </div>

            {connection.errorMessage && (
              <div className="mt-1 p-2 bg-rose-950/15 border border-rose-500/10 text-rose-400 rounded-md text-[9px] leading-normal">
                {connection.errorMessage}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-gray-900 bg-gray-950/40 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
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
  );
}
