/**
 * Ambient type for the Polar Checkout embed script loaded in index.html:
 * https://cdn.jsdelivr.net/npm/@polar-sh/checkout@0.1/dist/embed.global.js
 */
export {};

declare global {
  interface Window {
    PolarEmbedCheckout?: {
      create(checkoutUrl: string, theme?: 'light' | 'dark'): Promise<unknown>;
    };
  }
}
