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
    configMutation.mutate({
      ...config,
      unitTemp,
      unitWind,
      unitBaro,
      unitRain
    }, {
      onSuccess: () => {
        onClose();
      }
    });
  };

  return (
    <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      {/* Settings Dialog Container */}
      <div className="w-full max-w-md bg-[#0e111a] border border-gray-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-900 bg-gray-950/40">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-400" />
            <h2 className="text-white font-sans font-bold text-base tracking-tight">
              Console Unit Settings
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
        <div className="p-6 flex flex-col gap-5 select-none max-h-[50vh] overflow-y-auto custom-scrollbar">
          
          <p className="text-gray-400 text-xs leading-relaxed">
            Configure unit measurements display options on the console screen. Other backend settings and connection credentials can be managed in the top navigation bar.
          </p>

          {/* Unit Preferences Selector */}
          <div className="bg-gray-950/40 border border-[#2d343f] rounded-xl p-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Temperature */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Temperature</label>
                <select
                  value={unitTemp}
                  onChange={(e) => setUnitTemp(e.target.value as 'F' | 'C')}
                  className="bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-white font-sans text-xs focus:border-sky-500 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="F">Fahrenheit (&deg;F)</option>
                  <option value="C">Celsius (&deg;C)</option>
                </select>
              </div>

              {/* Wind Speed */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Wind Speed</label>
                <select
                  value={unitWind}
                  onChange={(e) => setUnitWind(e.target.value as 'mph' | 'kmh' | 'kts' | 'ms')}
                  className="bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-white font-sans text-xs focus:border-sky-500 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="mph">Miles / Hour (mph)</option>
                  <option value="kmh">Kilometers / Hour (km/h)</option>
                  <option value="kts">Knots (kts)</option>
                  <option value="ms">Meters / Second (m/s)</option>
                </select>
              </div>

              {/* Barometer */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Barometer</label>
                <select
                  value={unitBaro}
                  onChange={(e) => setUnitBaro(e.target.value as 'inHg' | 'hPa' | 'mmHg' | 'mb')}
                  className="bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-white font-sans text-xs focus:border-sky-500 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="inHg">Inches of Mercury (inHg)</option>
                  <option value="hPa">Hectopascals (hPa)</option>
                  <option value="mb">Millibars (mb)</option>
                  <option value="mmHg">Millimeters of Mercury (mmHg)</option>
                </select>
              </div>

              {/* Rainfall */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Rainfall</label>
                <select
                  value={unitRain}
                  onChange={(e) => setUnitRain(e.target.value as 'in' | 'mm')}
                  className="bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-white font-sans text-xs focus:border-sky-500 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="in">Inches (in)</option>
                  <option value="mm">Millimeters (mm)</option>
                </select>
              </div>
            </div>
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
            {configMutation.isPending ? 'Saving...' : 'Apply Units'}
          </button>
        </div>

      </div>
    </div>
  );
}
