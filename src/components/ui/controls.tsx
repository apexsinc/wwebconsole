/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 1: shared design-system primitives. Use these instead of
 * re-defining inputCls/selectCls/labelCls per file.
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, HTMLAttributes, LabelHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none min-h-[44px] px-5 py-2.5 cursor-pointer';

const variants: Record<Variant, string> = {
  primary: 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs',
  secondary:
    'bg-slate-900 hover:bg-slate-800 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-800 dark:border-white/10 text-white',
  ghost: 'text-slate-300 hover:text-white hover:bg-white/10',
  danger: 'bg-rose-600 hover:bg-rose-500 text-white',
};

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...rest} className={`${base} ${variants[variant]} ${className}`} />;
}

export function FieldLabel({ className = '', ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...rest}
      className={`block text-[11px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-300 ${className}`}
    />
  );
}

/** Non-control group heading (use with aria-labelledby on a group). */
export function FieldGroupLabel({ className = '', ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...rest}
      className={`block text-[11px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-300 ${className}`}
    />
  );
}

const fieldBase =
  'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400 min-h-[44px] ' +
  'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white ' +
  'focus:border-sky-600 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-600/10 dark:focus:ring-sky-500/20';

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${fieldBase} ${className}`} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`${fieldBase} cursor-pointer appearance-none pr-10 ${className}`}>
      {children}
    </select>
  );
}

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xs ${className}`}
    />
  );
}

export function Badge({
  tone = 'neutral',
  className = '',
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  const tones = {
    neutral: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/25',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
    danger: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25',
    info: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25',
  };
  return (
    <span
      {...rest}
      className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${tones[tone]} ${className}`}
    />
  );
}
