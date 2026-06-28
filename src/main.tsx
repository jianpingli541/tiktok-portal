import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import { registerSW } from 'virtual:pwa-register';
// i18n must be initialized before any component imports so that
// `useTranslation()` consumers see the configured instance on first render.
import './lib/i18n';
import { router } from './app/router';
import { useAuth } from '@/lib/auth/useAuth';
import { queryClient } from '@/lib/queryClient';
import { initObservability, reinitObservability } from '@/lib/observability';
import { getConsent } from '@/lib/consent';
import { useConsentStore } from '@/stores/consent';
import { ErrorFallback } from '@/components/ErrorFallback';
import './styles/index.css';

// Initialize Sentry FIRST (before MSW, React, or any app code runs) so that
// early errors during bootstrap still get reported. No-op unless
// VITE_SENTRY_ENABLED=true AND VITE_SENTRY_DSN is set.
//
// We pass the current consent state so tracing/replay sampling rates reflect
// the user's preference. If the user has not yet decided (decidedAt === null),
// analytics tracing stays disabled until they make a choice; the CookieBanner
// then re-inits Sentry via the ConsentSyncBridge below.
initObservability(getConsent());

// Service worker registration — auto-update strategy keeps users on the
// latest shell without prompting. Toast wiring is intentionally deferred
// (handlers are TODOs) so this PR stays scoped to the install itself.
registerSW({
  immediate: true,
  onNeedRefresh() {
    // TODO: wire to toast UI when design system lands
    console.info('[pwa] new version available — refresh to update');
  },
  onOfflineReady() {
    // TODO: wire to toast UI when design system lands
    console.info('[pwa] offline ready');
  },
});

// Dev-only: enable MSW. The `import.meta.env.DEV` literal is statically
// replaced by Vite — `false` in production builds, so the dynamic
// import (and MSW itself) is tree-shaken out of `dist/`.
async function enableMocking() {
  if (!import.meta.env.DEV) return;
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

/**
 * Whenever the user updates their cookie preferences via CookieBanner or
 * /privacy, re-init Sentry with the new consent so tracing / replay
 * sampling rates take effect.
 */
function ConsentSyncBridge() {
  const state = useConsentStore((s) => s.state);
  React.useEffect(() => {
    reinitObservability(state);
  }, [state]);
  return null;
}

function Bootstrap() {
  const { installUnauthorizedHandler } = useAuth();
  React.useEffect(() => installUnauthorizedHandler(), [installUnauthorizedHandler]);
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <ConsentSyncBridge />
      <RouterProvider router={router} />
    </Sentry.ErrorBoundary>
  );
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <Bootstrap />
      </QueryClientProvider>
    </React.StrictMode>
  );
});