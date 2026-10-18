import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// Configurazione di build e di sviluppo: React, PWA (manifest e service worker con aggiornamento automatico)
// e proxy delle chiamate /api verso il server.
// La versione dell'app è quella del package.json principale; arriva al codice come `__APP_VERSION__` (vedi src/version.ts).
const versione = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(versione) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'MyTask',
        short_name: 'MyTask',
        description: 'Idee, cose da fare e da scoprire',
        lang: 'it',
        start_url: '/',
        display: 'standalone',
        background_color: '#F1F0EC',
        theme_color: '#2F7D5B',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // ogni indirizzo di pagina offline serve index.html (app a pagina singola); le chiamate al server restano fuori dalla cache
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    port: 5173,
    fs: { allow: ['..'] }, // il codice in ../shared è condiviso col server
    // MYTASK_SERVER: indirizzo del server vero (es. https://mytask.tuodominio.it) per provare il sito in locale con i propri dati
    proxy: { '/api': { target: process.env.MYTASK_SERVER || 'http://localhost:8787', changeOrigin: true, secure: true } },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
