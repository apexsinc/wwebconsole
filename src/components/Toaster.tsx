/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Minimal toast system. Dispatch from anywhere:
 *   window.dispatchEvent(new CustomEvent('wwc:toast', { detail: { message, tone } }))
 */
import { useEffect, useState } from 'react';

export function toast(message: string, tone: 'info' | 'error' | 'success' = 'info') {
  window.dispatchEvent(new CustomEvent('wwc:toast', { detail: { message, tone } }));
}

type Toast = { id: number; message: string; tone: 'info' | 'error' | 'success' };
let nextId = 1;

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const d = (e as CustomEvent).detail as { message?: string; tone?: Toast['tone'] };
      if (!d?.message) return;
      const id = nextId++;
      setToasts((t) => [...t.slice(-2), { id, message: d.message!, tone: d.tone || 'info' }]);
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
    };
    window.addEventListener('wwc:toast', onToast);
    return () => window.removeEventListener('wwc:toast', onToast);
  }, []);

  if (toasts.length === 0) return null;
  const tones = {
    info: 'bg-slate-900 text-white border-white/10',
    error: 'bg-rose-950 text-rose-100 border-rose-500/30',
    success: 'bg-emerald-950 text-emerald-100 border-emerald-500/30',
  };
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 w-max max-w-[92vw]" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl ${tones[t.tone]}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
