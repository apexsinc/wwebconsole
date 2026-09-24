/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Accessible modal shell — role=dialog on the panel, Esc to close, focus
 * trap while open, focus return to the trigger on close, overlay click.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function Modal({
  title,
  icon,
  onClose,
  children,
  footer,
  labelledBy,
  describedBy,
}: {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
  describedBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const prevFocus = useRef<Element | null>(null);
  const titleSlot = labelledBy || `wwc-modal-title-${titleId}`;

  useEffect(() => {
    prevFocus.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Trap Tab inside the panel.
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    // Focus first focusable control for keyboard users.
    const t = window.setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      el?.focus();
    }, 30);
    // Hide the app behind the modal from assistive tech.
    const root = document.getElementById('root');
    const prevInert = root?.getAttribute('inert');
    root?.setAttribute('inert', '');
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearTimeout(t);
      if (prevInert === null) root?.removeAttribute('inert');
      else if (root && prevInert !== undefined) root.setAttribute('inert', prevInert);
      if (prevFocus.current instanceof HTMLElement) prevFocus.current.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleSlot}
        aria-describedby={describedBy}
        className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            {icon}
            <h2 id={titleSlot} className="text-slate-900 dark:text-white font-bold text-lg tracking-tight">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
