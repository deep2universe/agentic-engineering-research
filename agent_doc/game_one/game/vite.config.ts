import { defineConfig } from 'vite';

/**
 * Build-Konfiguration. Zwei Dinge sind nicht verhandelbar:
 *
 *  1. `__TEST__` schaltet die Debug-API (`window.__spiel`) frei. Im
 *     Produktions-Build ist sie statisch wegoptimiert — `tests/einheit/
 *     kein_debug_im_build.test.ts` beweist das gegen das echte Bundle.
 *  2. `target: 'es2022'`, weil der WebGPU-Pfad ohnehin nur in modernen
 *     Browsern laeuft und Down-Level-Transpilation nur Bundle-Groesse kostet.
 */
export default defineConfig(({ mode }) => ({
  base: './',
  define: {
    __TEST__: JSON.stringify(process.env.VITE_TESTHOOKS === '1'),
    __VERSION__: JSON.stringify('1.0.0'),
  },
  build: {
    target: 'es2022',
    sourcemap: mode !== 'production',
    chunkSizeWarningLimit: 2400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
  server: { host: '127.0.0.1', port: 5177, strictPort: true },
  preview: { host: '127.0.0.1', port: 5178, strictPort: true },
}));
