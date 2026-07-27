import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import path from 'path';
import fs from 'fs';
import { defineConfig, type Plugin } from 'vite';

/** Prevent .dev.vars from being copied into dist (secret leak risk). */
function stripDevVarsFromDist(): Plugin {
  const remove = () => {
    const targets = [
      path.resolve(__dirname, 'dist/wwebconsole/.dev.vars'),
      path.resolve(__dirname, 'dist/client/.dev.vars'),
    ];
    for (const t of targets) {
      try {
        if (fs.existsSync(t)) fs.unlinkSync(t);
      } catch {
        /* ignore */
      }
    }
  };
  return {
    name: 'strip-dev-vars-from-dist',
    writeBundle: remove,
    closeBundle: remove,
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare(), stripDevVarsFromDist()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  envPrefix: ['VITE_'],
});