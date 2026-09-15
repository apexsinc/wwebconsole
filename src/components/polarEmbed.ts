/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 0: lazy-load Polar checkout embed only when the checkout modal opens.
 * Previously loaded globally in index.html on every page (privacy/perf cost).
 */

const POLAR_EMBED_SRC = 'https://cdn.jsdelivr.net/npm/@polar-sh/checkout@0.1/dist/embed.global.js';

let loadPromise: Promise<void> | null = null;

export function loadPolarEmbed(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if ((window as any).PolarCheckout || document.querySelector('script[data-wwc-polar]')) {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = POLAR_EMBED_SRC;
    s.async = true;
    s.defer = true;
    s.dataset.wwcPolar = '1';
    s.onload = () => resolve();
    s.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load secure checkout. Please check your connection and retry.'));
    };
    document.head.appendChild(s);
  });
  return loadPromise;
}
