/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 6313-style console tile: a card with TWO equal large readings side by side
 * (digits + superscript stacked unit, caption below each), small icon
 * centered on a hairline divider at the card top — like the original
 * hardware. Sized in rem so TV root font-size scaling resizes the whole
 * board proportionally; type shrinks further on narrow phones so pairs
 * stay side-by-side without clipping.
 */
import type { LucideIcon } from 'lucide-react';
import { AlarmClock } from 'lucide-react';

/** Split a unit into superscript stack lines: 'in Hg' → ['in','Hg'], 'mph' → ['mi','hr']. */
function stackUnit(unit?: string): string[] {
  if (!unit) return [];
  const u = unit.trim();
  if (u === 'mph') return ['mi', 'hr'];
  if (u === 'km/h') return ['km', 'h'];
  if (u === 'm/s') return ['m', 's'];
  if (u === 'in/hr') return ['in', 'hr'];
  if (u === 'mm/hr') return ['mm', 'hr'];
  if (u === 'in Hg') return ['in', 'Hg'];
  if (u === 'mm Hg') return ['mm', 'Hg'];
  if (u.includes(' ')) return u.split(' ');
  return [u];
}

function Value({
  value,
  unit,
  xl,
}: {
  value: string;
  unit?: string;
  xl?: boolean;
}) {
  const lines = stackUnit(unit);
  const full = unit ? `${value} ${unit}` : value;
  return (
    <span className={`console-tile-value ${xl ? 'console-tile-value-xl' : ''}`} title={full}>
      <span aria-hidden="true">
        {value}
        {lines.length > 0 && !xl && (
          <span className="console-tile-ucol">
            <AlarmClock className="console-tile-alarm" aria-hidden="true" />
            {lines.length > 1 ? (
              <span className="console-tile-unit-stack">
                {lines.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </span>
            ) : (
              <span className="console-tile-unit">{lines[0]}</span>
            )}
          </span>
        )}
        {lines.length > 0 && xl && (
          <span className="console-tile-unit">{unit}</span>
        )}
      </span>
      <span className="sr-only">{full}</span>
    </span>
  );
}

export default function ConsoleTile({
  label,
  value,
  unit,
  subLabel,
  subValue,
  subUnit,
  icon: Icon,
  single,
  badge,
}: {
  label: string;
  value: string;
  unit?: string;
  subLabel?: string;
  subValue?: string;
  subUnit?: string;
  icon?: LucideIcon;
  /** Room mode: single aspect, oversized value for distance reading. */
  single?: boolean;
  /** Corner medallion straddling the tile edge at mid-height (6313 badges). */
  badge?: {
    icon: LucideIcon;
    label: string;
    value?: string;
    tone: string;
    side: 'left' | 'right';
    iconOnly?: boolean;
  };
}) {
  if (single) {
    return (
      <section
        aria-label={label}
        className="console-tile console-tile-single flex-1 flex min-h-0 flex-col justify-center items-center text-center py-[1.2rem]"
      >
        <Value value={value} unit={unit} xl />
        <span className="console-tile-label">{label}</span>
      </section>
    );
  }

  return (
    <section
      aria-label={subValue !== undefined ? `${label}, ${subLabel}` : label}
      className="console-tile flex-1 flex min-h-0 flex-col"
    >
      <div className="console-tile-top" aria-hidden="true">
        <span className="console-tile-rule" />
        {Icon && <Icon className="console-tile-glyph" />}
        <span className="console-tile-rule" />
      </div>
      <div className="flex flex-row items-stretch flex-1 min-h-0">
        <div className="console-tile-half">
          <Value value={value} unit={unit} />
          <span className="console-tile-label">{label}</span>
        </div>
        {subValue !== undefined && (
          <div className="console-tile-half">
            <Value value={subValue} unit={subUnit} />
            <span className="console-tile-label">{subLabel}</span>
          </div>
        )}
      </div>
      {badge && (
        <div
          role="img"
          aria-label={badge.value ? `${badge.label}: ${badge.value}` : badge.label}
          title={badge.value ? `${badge.label}: ${badge.value}` : badge.label}
          className={`console-bubble console-bubble-tone-${badge.tone} corner-badge corner-${badge.side} console-bubble-icon-only`}
        >
          <badge.icon aria-hidden="true" />
        </div>
      )}
    </section>
  );
}
