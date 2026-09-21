import { useState } from 'react';
import { Save, Settings } from 'lucide-react';
import { useWeatherStore } from '../store.js';
import { useConfigMutation } from '../services/api.js';
import Modal from './ui/Modal.js';
import { Button, Select, FieldLabel } from './ui/controls.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const config = useWeatherStore((state) => state.config);
  const tileLayout = useWeatherStore((s) => s.tileLayout);
  const setTileLayout = useWeatherStore((s) => s.setTileLayout);
  const highContrast = useWeatherStore((s) => s.highContrast);
  const setHighContrast = useWeatherStore((s) => s.setHighContrast);

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

  const selectWrap = 'relative';
  const chevron = 'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs';

  return (
    <Modal
      title="Console Settings"
      icon={<Settings className="w-5 h-5 text-sky-500" />}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={configMutation.isPending}>
            <Save className="w-4 h-4" />
            {configMutation.isPending ? 'Saving...' : 'Apply Units'}
          </Button>
        </>
      }
    >
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
            Configure unit measurements displayed on the console. Connection credentials can be managed via the <span className="text-sky-600 dark:text-sky-400 font-semibold">Configure</span> button in the top bar.
          </p>

          {/* Unit Preferences */}
          <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col gap-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Temperature */}
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="wwc-unit-temp">Temperature</FieldLabel>
                <div className={selectWrap}>
                  <Select
                    id="wwc-unit-temp"
                    value={unitTemp}
                    onChange={(e) => setUnitTemp(e.target.value as 'F' | 'C')}
                  >
                    <option value="F">Fahrenheit (°F)</option>
                    <option value="C">Celsius (°C)</option>
                  </Select>
                  <span className={chevron}>▾</span>
                </div>
              </div>

              {/* Wind Speed */}
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="wwc-unit-wind">Wind Speed</FieldLabel>
                <div className={selectWrap}>
                  <Select
                    id="wwc-unit-wind"
                    value={unitWind}
                    onChange={(e) => setUnitWind(e.target.value as 'mph' | 'kmh' | 'kts' | 'ms')}
                  >
                    <option value="mph">Miles / Hour (mph)</option>
                    <option value="kmh">Kilometers / Hour (km/h)</option>
                    <option value="kts">Knots (kts)</option>
                    <option value="ms">Meters / Second (m/s)</option>
                  </Select>
                  <span className={chevron}>▾</span>
                </div>
              </div>

              {/* Barometer */}
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="wwc-unit-baro">Barometer</FieldLabel>
                <div className={selectWrap}>
                  <Select
                    id="wwc-unit-baro"
                    value={unitBaro}
                    onChange={(e) => setUnitBaro(e.target.value as 'inHg' | 'hPa' | 'mmHg' | 'mb')}
                  >
                    <option value="inHg">Inches of Mercury (inHg)</option>
                    <option value="hPa">Hectopascals (hPa)</option>
                    <option value="mb">Millibars (mb)</option>
                    <option value="mmHg">Millimeters of Mercury (mmHg)</option>
                  </Select>
                  <span className={chevron}>▾</span>
                </div>
              </div>

              {/* Rainfall */}
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="wwc-unit-rain">Rainfall</FieldLabel>
                <div className={selectWrap}>
                  <Select
                    id="wwc-unit-rain"
                    value={unitRain}
                    onChange={(e) => setUnitRain(e.target.value as 'in' | 'mm')}
                  >
                    <option value="in">Inches (in)</option>
                    <option value="mm">Millimeters (mm)</option>
                  </Select>
                  <span className={chevron}>▾</span>
                </div>
              </div>
            </div>
          </div>

          {/* Display (mirrors the 6313's Customize Display screen) */}
          <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col gap-4 mt-4">
            <div className="flex flex-col gap-2">
              <FieldLabel id="wwc-layout-label">Tile layout</FieldLabel>
              <div role="group" aria-labelledby="wwc-layout-label" className="grid grid-cols-2 gap-2">
                {(['dense', 'room'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTileLayout(v)}
                    aria-pressed={tileLayout === v}
                    className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all min-h-[44px] ${
                      tileLayout === v
                        ? 'bg-sky-600 border-sky-600 text-white'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {v === 'dense' ? '3 × 2 tiles' : '2 × 2 big type'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">2 × 2 shows bigger values for reading across the room — Davis's own advice for distance viewing.</p>
            </div>
            <label className="flex items-center justify-between gap-3 cursor-pointer min-h-[44px]">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">High contrast display</span>
              <button
                type="button"
                role="switch"
                aria-checked={highContrast}
                aria-label="High contrast display"
                onClick={() => setHighContrast(!highContrast)}
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${highContrast ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${highContrast ? 'left-6' : 'left-1'}`} />
              </button>
            </label>
          </div>
    </Modal>
  );
}
