/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 6313-style console tile: caps label, tabular primary value + unit,
 * optional secondary aspect. Sized in rem so TV/big-screen type scaling
 * (root font-size) resizes the whole board proportionally.
 */
import type { LucideIcon } from 'lucide-react';

export default function ConsoleTile({
  label,
  value,
  unit,
  subLabel,
  subValue,
  subUnit,
  icon: Icon,
  single,
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
}) {
  return (
    <section
      aria-label={label}
      className={`console-tile flex-1 flex min-h-0 ${single ? 'flex-col justify-center items-center text-center py-[1.2rem]' : 'flex-row items-center gap-[0.9rem] px-[1.1rem] py-[0.9rem]'}`}
    >
      {Icon && !single && (
        <span aria-hidden="true" className="console-tile-icon shrink-0">
          <Icon />
        </span>
      )}
      <div className={`flex min-w-0 ${single ? 'flex-col items-center' : 'flex-col justify-center flex-1'}`}>
        <span className="console-tile-label">{label}</span>
        <span className={`console-tile-value ${single ? 'console-tile-value-xl' : ''}`}>
          {value}
          {unit && <span className="console-tile-unit">{unit}</span>}
        </span>
        {subValue !== undefined && !single && (
          <span className="console-tile-sub">
            {subLabel ? `${subLabel} ` : ''}
            <strong>{subValue}</strong>
            {subUnit ? ` ${subUnit}` : ''}
          </span>
        )}
      </div>
    </section>
  );
}
