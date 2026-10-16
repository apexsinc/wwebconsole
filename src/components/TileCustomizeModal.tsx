/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tile Customizer Modal: Allows users to configure any tile on the live console
 * to display telemetry from the WeatherLink API (Solar Radiation, UV Index,
 * Outside/Inside conditions, Wind, Rain, Barometer, Air Quality).
 */
import { useState, useMemo } from 'react';
import {
  SlidersHorizontal,
  RotateCcw,
  Check,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';
import Modal from './ui/Modal.js';
import { Button, Select, FieldLabel, FieldGroupLabel } from './ui/controls.js';
import { useWeatherStore } from '../store.js';
import { useConfigMutation } from '../services/api.js';
import { toast } from './Toaster.js';
import type { TileConfig } from '../types.js';
import {
  METRIC_REGISTRY,
  TILE_PRESETS,
  TILE_POSITIONS_DENSE,
  TILE_POSITIONS_ROOM,
  resolveTileProps,
  DEFAULT_TILES_DENSE,
  DEFAULT_TILES_ROOM,
} from './tileRegistry.js';
import ConsoleTile from './ConsoleTile.js';

interface TileCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tileKey: string | null;
  isRoomMode?: boolean;
}

export default function TileCustomizeModal({
  isOpen,
  onClose,
  tileKey,
  isRoomMode = false,
}: TileCustomizeModalProps) {
  const weather = useWeatherStore((s) => s.weather);
  const config = useWeatherStore((s) => s.config);
  const customTiles = useWeatherStore((s) => s.customTiles);
  const setTileConfig = useWeatherStore((s) => s.setTileConfig);
  const configMutation = useConfigMutation();

  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');

  // Find info about current slot
  const positionList = isRoomMode ? TILE_POSITIONS_ROOM : TILE_POSITIONS_DENSE;
  const currentSlot = positionList.find((p) => p.key === tileKey) || positionList[0];
  const activeKey = tileKey || currentSlot.key;

  const currentCustom = customTiles[activeKey];
  const defaultFallback = isRoomMode ? DEFAULT_TILES_ROOM[activeKey] : DEFAULT_TILES_DENSE[activeKey];
  const effectiveConfig = currentCustom || defaultFallback || { primaryMetric: 'temp' };

  // Local editor state
  const [single, setSingle] = useState<boolean>(Boolean(effectiveConfig.single));
  const [primaryMetric, setPrimaryMetric] = useState<string>(effectiveConfig.primaryMetric || 'temp');
  const [secondaryMetric, setSecondaryMetric] = useState<string>(effectiveConfig.secondaryMetric || 'feels_like');
  const [customLabel, setCustomLabel] = useState<string>(effectiveConfig.customLabel || '');
  const [customSubLabel, setCustomSubLabel] = useState<string>(effectiveConfig.customSubLabel || '');

  // Group metrics by category
  const categories = useMemo(() => {
    const map = new Map<string, typeof METRIC_REGISTRY[string][]>();
    Object.values(METRIC_REGISTRY).forEach((m) => {
      const list = map.get(m.category) || [];
      list.push(m);
      map.set(m.category, list);
    });
    return Array.from(map.entries());
  }, []);

  if (!isOpen || !tileKey) return null;

  // Real-time preview props
  const draftConfig: TileConfig = {
    single,
    primaryMetric,
    secondaryMetric: single ? undefined : secondaryMetric,
    customLabel: customLabel.trim() || undefined,
    customSubLabel: (single ? undefined : customSubLabel.trim()) || undefined,
  };

  const previewProps = resolveTileProps(
    activeKey,
    draftConfig,
    weather,
    config,
    isRoomMode
  );

  const handleApplyPreset = (presetConfig: TileConfig) => {
    setSingle(Boolean(presetConfig.single));
    setPrimaryMetric(presetConfig.primaryMetric);
    if (presetConfig.secondaryMetric) {
      setSecondaryMetric(presetConfig.secondaryMetric);
    }
    setCustomLabel(presetConfig.customLabel || '');
    setCustomSubLabel(presetConfig.customSubLabel || '');
  };

  const handleSave = () => {
    setTileConfig(activeKey, draftConfig);

    // Also persist to station server config if available
    const nextCustomTiles = { ...customTiles, [activeKey]: draftConfig };
    configMutation.mutate(
      { customTiles: nextCustomTiles },
      {
        onSuccess: () => {
          toast(`Updated ${currentSlot.label} tile configuration!`, 'success');
        },
        onError: () => {
          // LocalStorage already saved in store
          toast(`Saved ${currentSlot.label} tile locally!`, 'success');
        },
      }
    );

    onClose();
  };

  const handleReset = () => {
    const next = { ...customTiles };
    delete next[activeKey];
    useWeatherStore.getState().setAllTileConfigs(next);

    configMutation.mutate(
      { customTiles: next },
      {
        onSuccess: () => {
          toast(`Reset ${currentSlot.label} tile to default!`, 'info');
        },
      }
    );

    onClose();
  };

  const selectWrap = 'relative';
  const chevron = 'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs';

  return (
    <Modal
      title={`Customize Tile: ${currentSlot.label}`}
      icon={<SlidersHorizontal className="w-5 h-5 text-sky-500" />}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between w-full gap-2">
          <Button variant="ghost" onClick={handleReset} className="text-rose-500 hover:text-rose-600">
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset to Default
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              <Check className="w-4 h-4 mr-1.5" />
              Apply to Tile
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Slot context + Mini Position Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-sky-500">
              Position: {currentSlot.label}
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Default: {currentSlot.defaultName}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl bg-slate-200 dark:bg-white/10 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'presets'
                  ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 inline mr-1" />
              Quick Presets
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'custom'
                  ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 inline mr-1" />
              Custom Metric Picker
            </button>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="flex flex-col gap-1.5">
          <FieldGroupLabel>Live Console Preview</FieldGroupLabel>
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-300 dark:border-white/15 flex items-center justify-center">
            <div className="w-full max-w-[280px]">
              <ConsoleTile
                single={previewProps.single}
                label={previewProps.label}
                value={previewProps.value}
                unit={previewProps.unit}
                subLabel={previewProps.subLabel}
                subValue={previewProps.subValue}
                subUnit={previewProps.subUnit}
                icon={previewProps.icon}
              />
            </div>
          </div>
        </div>

        {/* Tab 1: Presets Grid */}
        {activeTab === 'presets' && (
          <div className="flex flex-col gap-2">
            <FieldGroupLabel>Choose a Telemetry Preset</FieldGroupLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
              {TILE_PRESETS.map((preset) => {
                const isSelected =
                  Boolean(preset.config.single) === single &&
                  preset.config.primaryMetric === primaryMetric &&
                  (single || preset.config.secondaryMetric === secondaryMetric);

                const Icon = preset.icon;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.config)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10 shadow-sm ring-1 ring-sky-500'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-900 dark:text-white">
                          {preset.name}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Custom Metric Picker */}
        {activeTab === 'custom' && (
          <div className="flex flex-col gap-4">
            {/* Layout Mode */}
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Tile Layout</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSingle(false)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    !single
                      ? 'bg-sky-600 border-sky-600 text-white'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Dual Reading (Two Side-by-Side)
                </button>
                <button
                  type="button"
                  onClick={() => setSingle(true)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    single
                      ? 'bg-sky-600 border-sky-600 text-white'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Single Reading (Large Display)
                </button>
              </div>
            </div>

            {/* Metric Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Primary Metric */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="tile-primary-metric">
                  {single ? 'Telemetry Metric' : 'Left (Primary) Reading'}
                </FieldLabel>
                <div className={selectWrap}>
                  <Select
                    id="tile-primary-metric"
                    value={primaryMetric}
                    onChange={(e) => setPrimaryMetric(e.target.value)}
                  >
                    {categories.map(([category, items]) => (
                      <optgroup key={category} label={category}>
                        {items.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label} ({m.format(weather, config).unit})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                  <span className={chevron} aria-hidden="true">▾</span>
                </div>
              </div>

              {/* Secondary Metric */}
              {!single && (
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="tile-secondary-metric">Right (Secondary) Reading</FieldLabel>
                  <div className={selectWrap}>
                    <Select
                      id="tile-secondary-metric"
                      value={secondaryMetric}
                      onChange={(e) => setSecondaryMetric(e.target.value)}
                    >
                      {categories.map(([category, items]) => (
                        <optgroup key={category} label={category}>
                          {items.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label} ({m.format(weather, config).unit})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                    <span className={chevron} aria-hidden="true">▾</span>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Label Overrides */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor="tile-custom-label">
                  Custom Label <span className="text-slate-400 font-normal">(Optional)</span>
                </FieldLabel>
                <input
                  id="tile-custom-label"
                  type="text"
                  placeholder={METRIC_REGISTRY[primaryMetric]?.label || ''}
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {!single && (
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="tile-custom-sublabel">
                    Custom Right Label <span className="text-slate-400 font-normal">(Optional)</span>
                  </FieldLabel>
                  <input
                    id="tile-custom-sublabel"
                    type="text"
                    placeholder={METRIC_REGISTRY[secondaryMetric]?.label || ''}
                    value={customSubLabel}
                    onChange={(e) => setCustomSubLabel(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
