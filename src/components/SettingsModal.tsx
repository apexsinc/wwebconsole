import { useState, useEffect } from 'react';
import { Save, Settings, Network, Tv, SlidersHorizontal } from 'lucide-react';
import { useWeatherStore } from '../store.js';
import { useConfigMutation } from '../services/api.js';
import { toast } from './Toaster.js';
import Modal from './ui/Modal.js';
import { Button, Select, FieldLabel, FieldGroupLabel } from './ui/controls.js';
import TileCustomizeModal from './TileCustomizeModal.js';
import {
  METRIC_REGISTRY,
  TILE_POSITIONS_DENSE,
  TILE_POSITIONS_ROOM,
} from './tileRegistry.js';

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
  const customTiles = useWeatherStore((s) => s.customTiles);
  const resetTileConfigs = useWeatherStore((s) => s.resetTileConfigs);

  const [customizingTileKey, setCustomizingTileKey] = useState<string | null>(null);
  const [unitTemp, setUnitTemp] = useState(config.unitTemp ?? 'F');
  const [unitWind, setUnitWind] = useState(config.unitWind ?? 'mph');
  const [unitBaro, setUnitBaro] = useState(config.unitBaro ?? 'inHg');
  const [unitRain, setUnitRain] = useState(config.unitRain ?? 'in');

  useEffect(() => {
    if (isOpen) {
      setUnitTemp(config.unitTemp ?? 'F');
      setUnitWind(config.unitWind ?? 'mph');
      setUnitBaro(config.unitBaro ?? 'inHg');
      setUnitRain(config.unitRain ?? 'in');
    }
  }, [isOpen, config]);

  const configMutation = useConfigMutation();

  if (!isOpen) return null;

  const handleSave = () => {
    configMutation.mutate(
      { unitTemp, unitWind, unitBaro, unitRain, tileLayout, highContrast },
      {
        onSuccess: () => {
          toast('Console display and unit settings saved!', 'success');
          onClose();
        },
        onError: (err: any) => {
          toast(err?.message || 'Failed to save settings. Please try again.', 'error');
        },
      }
    );
  };

  const openStationSetup = (tab: 'link' | 'tv') => {
    onClose();
    window.dispatchEvent(new CustomEvent('wwc:open-setup', { detail: { tab } }));
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
            {configMutation.isPending ? 'Saving...' : 'Apply Settings'}
          </Button>
        </>
      }
    >
      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
        Configure unit measurements and layout displayed on your live console.
      </p>

      {/* Quick Setup Links (especially useful in fullscreen mode) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
        <button
          type="button"
          onClick={() => openStationSetup('link')}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-xs font-semibold transition-all cursor-pointer text-left"
        >
          <Network className="w-4 h-4 shrink-0" />
          <span>WeatherLink API Credentials & Station DID</span>
        </button>
        <button
          type="button"
          onClick={() => openStationSetup('tv')}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 text-xs font-semibold transition-all cursor-pointer text-left"
        >
          <Tv className="w-4 h-4 shrink-0" />
          <span>TV Broadcast URLs & Share Links</span>
        </button>
      </div>

      {/* Unit Preferences */}
      <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col gap-4 mt-4">
        <FieldGroupLabel>Measurement Units</FieldGroupLabel>
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
              <span className={chevron} aria-hidden="true">▾</span>
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
              <span className={chevron} aria-hidden="true">▾</span>
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
              <span className={chevron} aria-hidden="true">▾</span>
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
              <span className={chevron} aria-hidden="true">▾</span>
            </div>
          </div>
        </div>
      </div>

      {/* Display (mirrors the 6313's Customize Display screen) */}
      <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col gap-4 mt-4">
        <div className="flex flex-col gap-2">
          <FieldGroupLabel id="wwc-layout-label">Tile layout</FieldGroupLabel>
          <div role="group" aria-labelledby="wwc-layout-label" className="grid grid-cols-2 gap-2">
            {(['dense', 'room'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTileLayout(v)}
                aria-pressed={tileLayout === v}
                className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all min-h-[44px] cursor-pointer ${
                  tileLayout === v
                    ? 'bg-sky-600 border-sky-600 text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                {v === 'dense' ? '3 × 2 tiles' : '2 × 2 big type'}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">2 × 2 shows bigger values for reading across the room — Davis's own advice for distance viewing.</p>
        </div>
        <div className="flex items-center justify-between gap-3 min-h-[44px]">
          <span id="wwc-contrast-label" className="text-sm font-semibold text-slate-700 dark:text-slate-200">High contrast display</span>
          <button
            type="button"
            role="switch"
            aria-checked={highContrast}
            aria-labelledby="wwc-contrast-label"
            onClick={() => setHighContrast(!highContrast)}
            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 cursor-pointer ${highContrast ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-700'}`}
          >
            <span aria-hidden="true" className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${highContrast ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* Tile Customization Section */}
      <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col gap-3 mt-4">
        <div className="flex items-center justify-between">
          <FieldGroupLabel>Customize Console Tiles</FieldGroupLabel>
          <button
            type="button"
            onClick={() => {
              resetTileConfigs();
              toast('All tiles reset to defaults!', 'info');
            }}
            className="text-xs text-rose-500 hover:text-rose-600 font-semibold cursor-pointer"
          >
            Reset All Tiles
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Click any tile slot below or use the sliders icon on the live console tiles to select data (Solar, UV, Temperature, Rain, Wind, Air Quality).
        </p>

        {/* Mini Grid Representation */}
        <div className="grid grid-cols-2 gap-2 mt-1">
          {(tileLayout === 'room' ? TILE_POSITIONS_ROOM : TILE_POSITIONS_DENSE).map((pos) => {
            const current = customTiles[pos.key];
            const activeTitle = current?.customLabel ||
              (current ? `${METRIC_REGISTRY[current.primaryMetric]?.shortLabel || current.primaryMetric}${current.secondaryMetric ? ` & ${METRIC_REGISTRY[current.secondaryMetric]?.shortLabel || current.secondaryMetric}` : ''}` : pos.defaultName);

            return (
              <button
                key={pos.key}
                type="button"
                onClick={() => setCustomizingTileKey(pos.key)}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-left hover:border-sky-500 transition-all cursor-pointer group"
              >
                <div className="min-w-0 pr-2">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-sky-500">
                    {pos.label}
                  </span>
                  <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {activeTitle}
                  </span>
                </div>
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-500 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      <TileCustomizeModal
        isOpen={Boolean(customizingTileKey)}
        onClose={() => setCustomizingTileKey(null)}
        tileKey={customizingTileKey}
        isRoomMode={tileLayout === 'room'}
      />
    </Modal>
  );
}
