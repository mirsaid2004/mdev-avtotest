import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon-32.png', 'favicon-16.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'MDEV-Avtotest - Yo\'l harakati qoidalari',
        short_name: 'MDEV-Avtotest',
        description:
          "Yo'l harakati qoidalari imtihoniga tayyorgarlik. 1353 ta savol, 4 tilda, offline ishlaydi.",
        theme_color: '#2050c8',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'uz',
        categories: ['education'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // the question bank is the app: without it there is nothing to study,
        // so it is precached rather than left to a runtime cache
        globPatterns: ['**/*.{js,css,html,woff2}', 'data/*.json', 'icons/*.png'],
        // questions.json alone is ~1.9 MB
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // take control of the page that registered us, so the very first visit
        // is already offline-capable instead of needing a reload first.
        // skipWaiting stays off: an update must not replace the app mid-exam,
        // which is what registerType 'prompt' is for.
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          {
            // question images: 156 MB in total, so never precached - cached as
            // they are actually seen, and immutable once fetched
            urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
              !sameOrigin && /\.(png|jpe?g|webp)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'question-images',
              expiration: { maxEntries: 900, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    // so you can open it on your phone over wifi while building
    host: true,
  },
})
