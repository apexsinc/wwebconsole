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
import { Thermometer, Droplet, Cloud, Wind, CloudRain } from 'lucide-react';
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
  const trendSigned = `${weather.bar_trend >= 0 ? '+' : ''}${trend}`;
  const windDec = 1;
  const wind2 = convertWind(weather.wind_speed_avg_2_min, config.unitWind).toFixed(windDec);
  const wind10 = convertWind(weather.wind_speed_avg_10_min, config.unitWind).toFixed(windDec);
  const gust = convertWind(weather.wind_speed_last, config.unitWind).toFixed(windDec);
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
      <Header />
      <div className="console-grid">
        <div className="console-col">
          <ConsoleTile label="Outside temp" value={temp} unit={tempUnit} icon={Thermometer} subLabel="Feels" subValue={feels} subUnit={tempUnit} />
          <ConsoleTile label="Outside humidity" value={hum} unit="%" icon={Droplet} subLabel="Dew" subValue={dew} subUnit={tempUnit} />
          <ConsoleTile label="Inside temp" value={tempIn} unit={tempUnit} icon={Thermometer} subLabel="Hum in" subValue={humIn} subUnit="%" />
        </div>
        <div className="console-center">
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
          <ConsoleTile label="Barometer" value={baro} unit={baroUnit} icon={Cloud} subLabel="Trend" subValue={trendSigned} subUnit={baroUnit} />
          <ConsoleTile label="Wind 2-min" value={wind2} unit={windUnit} icon={Wind} subLabel="10-min" subValue={wind10} subUnit={windUnit} />
          <ConsoleTile label="Rain rate" value={rate} unit={rainUnit} icon={CloudRain} subLabel="Daily" subValue={daily} subUnit={rainDayUnit} />
        </div>
      </div>
    </div>
  );
}
