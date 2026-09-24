/**
 * WCAG 2.2 AA contrast regression test (normal text: 4.5:1 minimum).
 * Pairs mirror the palette used by src/index.css console variables and
 * Tailwind grays on dark surfaces. If a pair below ever fails, the
 * corresponding CSS color must be darkened/lightened — do not lower min.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function ratio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const PAIRS: [string, string, string][] = [
  // [background, foreground, label]
  ['#0a0d14', '#9ca3af', 'tv hint gray-400 on near-black'],
  ['#030712', '#9ca3af', 'footer gray-400 on near-black'],
  ['#030712', '#d1d5db', 'ticker gray-300 on near-black'],
  ['#ffffff', '#64748b', 'slate-500 on white'],
  ['#d7dfea', '#47546f', 'console sub text on light card'],
  ['#f4f6fa', '#3d4f6f', 'rose number on light disc'],
  ['#f4f6fa', '#4b5b76', 'rose sub text on light disc'],
  ['#0b7a72', '#ffffff', 'teal badge fill'],
  ['#166b45', '#ffffff', 'green badge fill'],
  ['#7a5a0e', '#ffffff', 'amber badge fill'],
  ['#8f4c10', '#ffffff', 'orange badge fill'],
  ['#3a4656', '#ffffff', 'slate badge fill'],
  ['#2b333d', '#ffffff', 'indigo badge fill'],
  ['#0e111a', '#94a3b8', 'slate-400 on dark surface'],
];

describe('a11y contrast pairs (WCAG AA 4.5:1)', () => {
  for (const [bg, fg, label] of PAIRS) {
    it(`${label}: ${ratio(bg, fg).toFixed(2)}:1`, () => {
      assert.ok(ratio(bg, fg) >= 4.5, `${label} is ${ratio(bg, fg).toFixed(2)}:1, want >= 4.5:1`);
    });
  }
});
