/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 16-wind compass text shared by the rose, ticker, and tooltips.
 * Normalizes any numeric input (negative, >360, NaN) to a valid label.
 */

const DIRECTIONS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

export function getWindDirectionText(deg: number): string {
  if (!Number.isFinite(deg)) return '--';
  const norm = ((deg % 360) + 360) % 360;
  return DIRECTIONS[Math.round(norm / 22.5) % 16]!;
}
