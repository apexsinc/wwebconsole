/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared 6313-style console board used by /app and /tv so both displays
 * always match. Layout follows the hardware: data tiles around a central
 * wind rose with weather bubbles, header on top, ticker taskbar below
 * (rendered by BottomBar). `dense` = 3×2 tiles, `room` = 2×2 big-type
 * tiles for across-the-room reading (per Davis's own guidance).
 */
import { useState } from 'react';
import { Wind, CloudRain, Moon, Droplet } from 'lucide-react';
import { useWeatherStore } from '../store.js';
import CompassRose from './CompassRose.js';
import Header from './Header.js';
import ConsoleTile from './ConsoleTile.js';
import WeatherBubbles from './WeatherBubbles.js';
import TileCustomizeModal from './TileCustomizeModal.js';
import { resolveTileProps } from './tileRegistry.js';
import {
  convertWind, getWindUnit,
  convertRain, getRainUnit, rainDecimals,
} from './units.js';

export default function ConsoleBoard() {
  const weather = useWeatherStore((s) => s.weather);
  const config = useWeatherStore((s) => s.config);
  const layout = useWeatherStore((s) => s.tileLayout);
  const customTiles = useWeatherStore((s) => s.customTiles);

  const [customizingKey, setCustomizingKey] = useState<string | null>(null);

  // Weather bubble & badge telemetry
  const windDec = 1;
  const gustRaw = weather.wind_gust_10_min > 0 ? weather.wind_gust_10_min : weather.wind_speed_last;
  const gust = convertWind(gustRaw, config.unitWind).toFixed(windDec);
  const windUnit = getWindUnit(config.unitWind);
  const rainDec = rainDecimals(config.unitRain);
  const daily = convertRain(weather.rainfall_daily, config.unitRain).toFixed(rainDec);
  const rainDayUnit = getRainUnit(config.unitRain);
  const humIn = weather.hum_in.toFixed(0);

  if (layout === 'room') {
    const r0 = resolveTileProps('room_0', customTiles.room_0, weather, config, true);
    const r1 = resolveTileProps('room_1', customTiles.room_1, weather, config, true);
    const r2 = resolveTileProps('room_2', customTiles.room_2, weather, config, true);
    const r3 = resolveTileProps('room_3', customTiles.room_3, weather, config, true);

    return (
      <div className="console-board console-board-room">
        <Header />
        <div className="console-room-grid">
          <ConsoleTile
            single={r0.single}
            label={r0.label}
            value={r0.value}
            unit={r0.unit}
            subLabel={r0.subLabel}
            subValue={r0.subValue}
            subUnit={r0.subUnit}
            icon={r0.icon}
            onCustomize={() => setCustomizingKey('room_0')}
          />
          <ConsoleTile
            single={r1.single}
            label={r1.label}
            value={r1.value}
            unit={r1.unit}
            subLabel={r1.subLabel}
            subValue={r1.subValue}
            subUnit={r1.subUnit}
            icon={r1.icon}
            onCustomize={() => setCustomizingKey('room_1')}
          />
          <ConsoleTile
            single={r2.single}
            label={r2.label}
            value={r2.value}
            unit={r2.unit}
            subLabel={r2.subLabel}
            subValue={r2.subValue}
            subUnit={r2.subUnit}
            icon={r2.icon}
            onCustomize={() => setCustomizingKey('room_2')}
          />
          <ConsoleTile
            single={r3.single}
            label={r3.label}
            value={r3.value}
            unit={r3.unit}
            subLabel={r3.subLabel}
            subValue={r3.subValue}
            subUnit={r3.subUnit}
            icon={r3.icon}
            onCustomize={() => setCustomizingKey('room_3')}
          />
        </div>
        <div className="console-room-rose">
          <CompassRose />
        </div>
        <TileCustomizeModal
          isOpen={Boolean(customizingKey)}
          onClose={() => setCustomizingKey(null)}
          tileKey={customizingKey}
          isRoomMode
        />
      </div>
    );
  }

  const t0 = resolveTileProps('tile_0', customTiles.tile_0, weather, config, false);
  const t1 = resolveTileProps('tile_1', customTiles.tile_1, weather, config, false);
  const t2 = resolveTileProps('tile_2', customTiles.tile_2, weather, config, false);
  const t3 = resolveTileProps('tile_3', customTiles.tile_3, weather, config, false);
  const t4 = resolveTileProps('tile_4', customTiles.tile_4, weather, config, false);
  const t5 = resolveTileProps('tile_5', customTiles.tile_5, weather, config, false);

  return (
    <div className="console-board">
      <div className="console-grid">
        <div className="console-col">
          <ConsoleTile
            single={t0.single}
            label={t0.label}
            value={t0.value}
            unit={t0.unit}
            subLabel={t0.subLabel}
            subValue={t0.subValue}
            subUnit={t0.subUnit}
            icon={t0.icon}
            badge={{ icon: Wind, label: 'Gust', value: `${gust} ${windUnit}`, tone: 'teal', side: 'right' }}
            onCustomize={() => setCustomizingKey('tile_0')}
          />
          <ConsoleTile
            single={t1.single}
            label={t1.label}
            value={t1.value}
            unit={t1.unit}
            subLabel={t1.subLabel}
            subValue={t1.subValue}
            subUnit={t1.subUnit}
            icon={t1.icon}
            onCustomize={() => setCustomizingKey('tile_1')}
          />
          <ConsoleTile
            single={t2.single}
            label={t2.label}
            value={t2.value}
            unit={t2.unit}
            subLabel={t2.subLabel}
            subValue={t2.subValue}
            subUnit={t2.subUnit}
            icon={t2.icon}
            badge={{ icon: Droplet, label: 'Inside humidity', value: `${humIn} %`, tone: 'green', side: 'right' }}
            onCustomize={() => setCustomizingKey('tile_2')}
          />
        </div>
        <div className="console-center">
          <Header />
          <CompassRose />
          <WeatherBubbles
            gust={gust}
            gustUnit={windUnit}
            dailyRain={daily}
            rainUnit={rainDayUnit}
            sunrise={weather.sunrise}
            sunset={weather.sunset}
            moonPhase={weather.moon_phase}
          />
        </div>
        <div className="console-col">
          <ConsoleTile
            single={t3.single}
            label={t3.label}
            value={t3.value}
            unit={t3.unit}
            subLabel={t3.subLabel}
            subValue={t3.subValue}
            subUnit={t3.subUnit}
            icon={t3.icon}
            badge={{ icon: CloudRain, label: 'Daily rain', value: `${daily} ${rainDayUnit}`, tone: 'sky', side: 'left' }}
            onCustomize={() => setCustomizingKey('tile_3')}
          />
          <ConsoleTile
            single={t4.single}
            label={t4.label}
            value={t4.value}
            unit={t4.unit}
            subLabel={t4.subLabel}
            subValue={t4.subValue}
            subUnit={t4.subUnit}
            icon={t4.icon}
            onCustomize={() => setCustomizingKey('tile_4')}
          />
          <ConsoleTile
            single={t5.single}
            label={t5.label}
            value={t5.value}
            unit={t5.unit}
            subLabel={t5.subLabel}
            subValue={t5.subValue}
            subUnit={t5.subUnit}
            icon={t5.icon}
            badge={{ icon: Moon, label: 'Moon', value: weather.moon_phase, tone: 'indigo', side: 'left', iconOnly: true }}
            onCustomize={() => setCustomizingKey('tile_5')}
          />
        </div>
      </div>
      <TileCustomizeModal
        isOpen={Boolean(customizingKey)}
        onClose={() => setCustomizingKey(null)}
        tileKey={customizingKey}
        isRoomMode={false}
      />
    </div>
  );
}
