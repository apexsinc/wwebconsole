/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared unit conversions (single source for /app and /tv boards).
 */

export function convertTemp(tempF: number, unit?: 'F' | 'C') {
  return unit === 'C' ? ((tempF - 32) * 5) / 9 : tempF;
}
export function getTempUnit(unit?: 'F' | 'C') {
  return unit === 'C' ? '°C' : '°F';
}

export function convertWind(speedMph: number, unit?: string) {
  if (unit === 'kmh') return speedMph * 1.60934;
  if (unit === 'kts') return speedMph * 0.868976;
  if (unit === 'ms') return speedMph * 0.44704;
  return speedMph;
}
export function getWindUnit(unit?: string) {
  return unit === 'kmh' ? 'km/h' : unit === 'kts' ? 'kts' : unit === 'ms' ? 'm/s' : 'mph';
}

export function convertBaro(baroInHg: number, unit?: string) {
  if (unit === 'hPa' || unit === 'mb') return baroInHg * 33.8639;
  if (unit === 'mmHg') return baroInHg * 25.4;
  return baroInHg;
}
export function getBaroUnit(unit?: string) {
  return unit === 'hPa' ? 'hPa' : unit === 'mb' ? 'mb' : unit === 'mmHg' ? 'mm Hg' : 'in Hg';
}
export function baroDecimals(unit?: string) {
  return unit === 'inHg' || unit === 'mmHg' ? 3 : 1;
}

export function convertRain(rainInches: number, unit?: string) {
  return unit === 'mm' ? rainInches * 25.4 : rainInches;
}
export function getRainUnit(unit?: string) {
  return unit === 'mm' ? 'mm' : 'in';
}
export function rainDecimals(unit?: string) {
  return unit === 'mm' ? 1 : 2;
}
