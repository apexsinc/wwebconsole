import { useState } from 'react';
import { X, Save, Settings } from 'lucide-react';
import { useWeatherStore } from '../store.js';
import { useConfigMutation } from '../services/api.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const config = useWeatherStore((state) => state.config);

  const [unitTemp, setUnitTemp] = useState(config.unitTemp ?? 'F');
  const [unitWind, setUnitWind] = useState(config.unitWind ?? 'mph');
  const [unitBaro, setUnitBaro] = useState(config.unitBaro ?? 'inHg');
  const [unitRain, setUnitRain] = useState(config.unitRain ?? 'in');

  const configMutation = useConfigMutation();

  if (!isOpen) return null;

  const handleSave = () => {
    configMutation.mutate(
      { unitTemp, unitWind, unitBaro, unitRain },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const selectCls =
    'w-full bg-slate-800/80 border border-slate-600/60 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 rounded-lg px-3 py-2.5 text-white font-sans text-xs focus:outline-none transition-all cursor-pointer appearance-none';
  const labelCls = 'text-[11px] text-slate-200 uppercase tracking-wider font-bold';

  return (
    <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0e111a] border border-gray-700/60 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/40">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-400" />
            <h2 className="text-white font-sans font-bold text-base tracking-tight">
              Console Unit Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-all cursor-pointer p-1 rounded-lg hover:bg-gray-800 focus:outline-none"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-5 select-none max-h-[50vh] overflow-y-auto custom-scrollbar">
          <p className="text-slate-300 text-xs leading-relaxed">
            Configure unit measurements displayed on the console. Connection credentials can be managed via the <span className="text-sky-400 font-semibold">Configure</span> button in the top bar.
          </p>

          {/* Unit Preferences */}
          <div className="bg-gray-900/60 border border-gray-700/60 rounded-xl p-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">

              {/* Temperature */}
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Temperature</label>
                <div className="relative">
                  <select
                    value={unitTemp}
                    onChange={(e) => setUnitTemp(e.target.value as 'F' | 'C')}
                    className={selectCls}
                  >
                    <option value="F">Fahrenheit (°F)</option>
                    <option value="C">Celsius (°C)</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
                </div>
              </div>

              {/* Wind Speed */}
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Wind Speed</label>
                <div className="relative">
                  <select
                    value={unitWind}
                    onChange={(e) => setUnitWind(e.target.value as 'mph' | 'kmh' | 'kts' | 'ms')}
                    className={selectCls}
                  >
                    <option value="mph">Miles / Hour (mph)</option>
                    <option value="kmh">Kilometers / Hour (km/h)</option>
                    <option value="kts">Knots (kts)</option>
                    <option value="ms">Meters / Second (m/s)</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
                </div>
              </div>

              {/* Barometer */}
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Barometer</label>
                <div className="relative">
                  <select
                    value={unitBaro}
                    onChange={(e) => setUnitBaro(e.target.value as 'inHg' | 'hPa' | 'mmHg' | 'mb')}
                    className={selectCls}
                  >
                    <option value="inHg">Inches of Mercury (inHg)</option>
                    <option value="hPa">Hectopascals (hPa)</option>
                    <option value="mb">Millibars (mb)</option>
                    <option value="mmHg">Millimeters of Mercury (mmHg)</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
                </div>
              </div>

              {/* Rainfall */}
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Rainfall</label>
                <div className="relative">
                  <select
                    value={unitRain}
                    onChange={(e) => setUnitRain(e.target.value as 'in' | 'mm')}
                    className={selectCls}
                  >
                    <option value="in">Inches (in)</option>
                    <option value="mm">Millimeters (mm)</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-950/40 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer rounded-lg hover:bg-gray-800 focus:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={configMutation.isPending}
            className="px-4 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white rounded-lg transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 focus:outline-none disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {configMutation.isPending ? 'Saving...' : 'Apply Units'}
          </button>
        </div>
      </div>
    </div>
  );
}
