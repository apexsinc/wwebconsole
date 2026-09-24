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
import { Thermometer, Droplet, Cloud, Wind, CloudRain, Moon } from 'lucide-react';
import { useWeatherStore } from '../store.js';
import CompassRose from './CompassRose.js';
import Header from './Header.js';
import ConsoleTile from './ConsoleTile.js';
import WeatherBubbles from './WeatherBubbles.js';
import {
  convertTemp, getTempUnit,
  convertWind, getWindUnit,
  convertBaro, getBaroUnit, baroDecimals,
  convertRain, getRainUnit, rainDecimals,
} from './units.js';

export default function ConsoleBoard() {
  const weather = useWeatherStore((s) => s.weather);
  const config = useWeatherStore((s) => s.config);
  const layout = useWeatherStore((s) => s.tileLayout);

  const temp = convertTemp(weather.temp, config.unitTemp).toFixed(1);
  const tempUnit = getTempUnit(config.unitTemp);
  const feels = convertTemp(weather.feels_like, config.unitTemp).toFixed(1);
  const dew = convertTemp(weather.dew_point, config.unitTemp).toFixed(1);
  const tempIn = convertTemp(weather.temp_in, config.unitTemp).toFixed(1);
  const hum = weather.hum.toFixed(0);
  const humIn = weather.hum_in.toFixed(0);
  const baroDec = baroDecimals(config.unitBaro);
  const baro = convertBaro(weather.bar_sea_level, config.unitBaro).toFixed(baroDec);
  const baroUnit = getBaroUnit(config.unitBaro);
  const trend = convertBaro(weather.bar_trend, config.unitBaro).toFixed(baroDec);
  const windDec = 1;
  const wind2 = convertWind(weather.wind_speed_avg_2_min, config.unitWind).toFixed(windDec);
  const wind10 = convertWind(weather.wind_speed_avg_10_min, config.unitWind).toFixed(windDec);
  // True 10-minute gust; older cached payloads predate the field, so fall
  // back to current speed rather than reporting a false 0.0.
  const gustRaw = weather.wind_gust_10_min > 0 ? weather.wind_gust_10_min : weather.wind_speed_last;
  const gust = convertWind(gustRaw, config.unitWind).toFixed(windDec);
  const windUnit = getWindUnit(config.unitWind);
  const rainDec = rainDecimals(config.unitRain);
  const rate = convertRain(weather.rain_rate_last, config.unitRain).toFixed(rainDec);
  const daily = convertRain(weather.rainfall_daily, config.unitRain).toFixed(rainDec);
  const rainUnit = `${getRainUnit(config.unitRain)}/hr`;
  const rainDayUnit = getRainUnit(config.unitRain);

  if (layout === 'room') {
    return (
      <div className="console-board console-board-room">
        <Header />
        <div className="console-room-grid">
          <ConsoleTile single label="Outside temp" value={temp} unit={tempUnit} icon={Thermometer} />
          <ConsoleTile single label="Wind" value={wind2} unit={windUnit} icon={Wind} />
          <ConsoleTile single label="Barometer" value={baro} unit={baroUnit} icon={Cloud} />
          <ConsoleTile single label="Rain rate" value={rate} unit={rainUnit} icon={CloudRain} />
        </div>
        <div className="console-room-rose">
          <CompassRose />
        </div>
      </div>
    );
  }

  return (
    <div className="console-board">
      <div className="console-grid">
        <div className="console-col">
          <ConsoleTile label="Outside Temperature" value={temp} unit={tempUnit} icon={Thermometer} subLabel="Feels Like" subValue={feels} subUnit={tempUnit}
            badge={{ icon: Wind, label: 'Gust', value: `${gust} ${windUnit}`, tone: 'teal', side: 'right' }} />
          <ConsoleTile label="Outside Humidity" value={hum} unit="%" icon={Droplet} subLabel="Dew Point" subValue={dew} subUnit={tempUnit} />
          <ConsoleTile label="Inside Temperature" value={tempIn} unit={tempUnit} icon={Thermometer} subLabel="Inside Humidity" subValue={humIn} subUnit="%"
            badge={{ icon: Droplet, label: 'Inside humidity', value: `${humIn} %`, tone: 'green', side: 'right' }} />
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
          <ConsoleTile label="Current Barometer" value={baro} unit={baroUnit} icon={Cloud} subLabel="Barometer Trend" subValue={trend} subUnit={baroUnit}
            badge={{ icon: CloudRain, label: 'Daily rain', value: `${daily} ${rainDayUnit}`, tone: 'sky', side: 'left' }} />
          <ConsoleTile label="2-Minute Average Wind Speed" value={wind2} unit={windUnit} icon={Wind} subLabel="10-Minute Average Wind Speed" subValue={wind10} subUnit={windUnit} />
          <ConsoleTile label="Current Rain Rate" value={rate} unit={rainUnit} icon={CloudRain} subLabel="Daily Rain" subValue={daily} subUnit={rainDayUnit}
            badge={{ icon: Moon, label: 'Moon', value: weather.moon_phase, tone: 'indigo', side: 'left', iconOnly: true }} />
        </div>
      </div>
    </div>
  );
}
