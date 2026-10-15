import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
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
        background_color: '#F7F6F2',
        theme_color: '#2F7D5B',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
