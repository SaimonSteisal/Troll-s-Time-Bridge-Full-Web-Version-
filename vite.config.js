// vite.config.js
// Docs: https://vitejs.dev/config/
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built game can be hosted on GitHub Pages / itch.io subpaths.
  base: './',

  publicDir: 'assets',

  server: {
    host: true,        // expose on LAN -> open the dev server on your phone to test touch/gamepad
    port: 5173,
    strictPort: false,
    open: false,
  },

  build: {
    target: 'es2020',  // safe floor for iOS Safari / older Android WebViews
    outDir: 'dist',
    assetsInlineLimit: 0,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'], // keep the engine in its own cacheable chunk
        },
      },
    },
  },
});
