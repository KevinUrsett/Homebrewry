import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        id: '/',
        name: 'Homebrewry',
        short_name: 'Homebrewry',
        description: 'A local-first editor for D&D-style brew documents.',
        start_url: '/',
        scope: '/',
        theme_color: '#2c211b',
        background_color: '#f7f0df',
        display: 'standalone',
        display_override: ['standalone'],
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true
  }
});
