import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'node:path';
import fs from 'node:fs';

// Only enable the Sentry plugin when CI/build environment provides all three:
//   SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
// Local dev builds silently skip source-map upload.
const sentryPlugin = (() => {
  const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_RELEASE } = process.env;
  if (!SENTRY_AUTH_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT) return null;
  return sentryVitePlugin({
    org: SENTRY_ORG,
    project: SENTRY_PROJECT,
    authToken: SENTRY_AUTH_TOKEN,
    release: SENTRY_RELEASE ? { name: SENTRY_RELEASE } : undefined,
    sourcemaps: {
      assets: './dist/**',
      filesToDeleteAfterUpload: ['./dist/**/*.map'],
    },
  });
})();

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Static assets copied as-is into the precache manifest. PWA icons live
      // in `public/` so they land in `dist/` and workbox picks them up via
      // globPatterns below.
      includeAssets: ['favicon.svg', 'robots.txt', 'pwa-192.png', 'pwa-512.png', 'pwa-512-maskable.png'],
      manifest: {
        name: 'TIKTON Portal',
        short_name: 'TIKTON',
        description: 'Video repurposing platform',
        theme_color: '#18181b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // SPA fallback: any navigation that doesn't match a precached route
        // returns index.html so react-router can take over. /v1/* is the API
        // surface and must NEVER fall back to HTML — caching an SPA shell
        // for an API call would corrupt JSON consumers.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/v1\//],
        runtimeCaching: [
          {
            // Plans are small + rarely change. NetworkFirst lets us refresh
            // in the background while still showing the last good copy
            // instantly when offline.
            urlPattern: ({ url }) => url.pathname.startsWith('/v1/plans'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'plans-cache',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            // Never cache auth: tokens + sessions must always go to the
            // server and never leak into service-worker storage.
            urlPattern: ({ url }) => url.pathname.startsWith('/v1/auth/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      // Dev mode generates its own dev-dist/ folder; keep it off so the dev
      // server isn't slowed by workbox instrumentation.
      devOptions: { enabled: false },
    }),
    ...(sentryPlugin ? [sentryPlugin] : []),
    // Strip MSW worker file from production builds. main.tsx already gates
    // MSW startup behind `import.meta.env.DEV`, but Vite still copies
    // anything in `public/` to `dist/` by default — leaving the worker file
    // shipped to prod would be misleading at best.
    {
      name: 'strip-msw-from-prod',
      apply: 'build',
      closeBundle() {
        const target = path.resolve(__dirname, 'dist/mockServiceWorker.js');
        try {
          fs.unlinkSync(target);
        } catch {
          /* not present, ignore */
        }
      },
    },
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 5173 },
  build: { target: 'es2022', sourcemap: !!sentryPlugin },
});