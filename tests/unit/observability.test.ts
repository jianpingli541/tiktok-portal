import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @sentry/react so we can verify initObservability gating without
// touching the real SDK.
vi.mock('@sentry/react', () => {
  return {
    init: vi.fn(),
    captureException: vi.fn(),
    browserTracingIntegration: vi.fn(() => ({ name: 'BrowserTracing' })),
    replayIntegration: vi.fn(() => ({ name: 'Replay' })),
    ErrorBoundary: ({ children }: { children: React.ReactNode }) =>
      children as React.ReactElement,
  };
});

describe('observability.initObservability', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    // Reset the Sentry.init mock call history so test ordering doesn't matter.
    const Sentry = await import('@sentry/react');
    (Sentry.init as ReturnType<typeof vi.fn>).mockClear();
    (Sentry.browserTracingIntegration as ReturnType<typeof vi.fn>).mockClear();
    (Sentry.replayIntegration as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is a no-op when VITE_SENTRY_ENABLED is unset', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    // VITE_SENTRY_ENABLED intentionally not stubbed — falls through to
    // optional().transform(undefined) === false
    const Sentry = await import('@sentry/react');
    const { initObservability } = await import('@/lib/observability');
    initObservability();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('is a no-op when VITE_SENTRY_ENABLED=false', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    vi.stubEnv('VITE_SENTRY_ENABLED', 'false');
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@example.ingest.sentry.io/1');
    const Sentry = await import('@sentry/react');
    const { initObservability } = await import('@/lib/observability');
    initObservability();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('is a no-op when DSN is missing even if enabled=true', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    vi.stubEnv('VITE_SENTRY_ENABLED', 'true');
    // VITE_SENTRY_DSN not set — optional().url() undefined
    const Sentry = await import('@sentry/react');
    const { initObservability } = await import('@/lib/observability');
    initObservability();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('initializes Sentry when enabled=true and DSN set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    vi.stubEnv('VITE_SENTRY_ENABLED', 'true');
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@example.ingest.sentry.io/1');
    vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'production');
    const Sentry = await import('@sentry/react');
    const { initObservability } = await import('@/lib/observability');
    initObservability({ necessary: true, analytics: true, marketing: false, decidedAt: new Date().toISOString() });
    expect(Sentry.init).toHaveBeenCalledOnce();
    const call = (Sentry.init as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.dsn).toBe('https://k@example.ingest.sentry.io/1');
    expect(call.environment).toBe('production');
    expect(call.sendDefaultPii).toBe(false);
    expect(call.tracesSampleRate).toBe(0.1);
    expect(typeof call.beforeSend).toBe('function');
    expect(call.integrations).toHaveLength(2);
    expect(call.replaysSessionSampleRate).toBe(0);
    expect(call.replaysOnErrorSampleRate).toBe(0.1);
  });

  it('uses tracesSampleRate=1.0 in development environment', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    vi.stubEnv('VITE_SENTRY_ENABLED', 'true');
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@example.ingest.sentry.io/1');
    vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'development');
    const Sentry = await import('@sentry/react');
    const { initObservability } = await import('@/lib/observability');
    initObservability({ necessary: true, analytics: true, marketing: false, decidedAt: new Date().toISOString() });
    const call = (Sentry.init as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.tracesSampleRate).toBe(1.0);
  });

  it('beforeSend filters request.headers.authorization and cookies', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    vi.stubEnv('VITE_SENTRY_ENABLED', 'true');
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@example.ingest.sentry.io/1');
    const Sentry = await import('@sentry/react');
    const { initObservability } = await import('@/lib/observability');
    initObservability({ necessary: true, analytics: true, marketing: false, decidedAt: new Date().toISOString() });
    const beforeSend = (Sentry.init as ReturnType<typeof vi.fn>).mock.calls[0][0].beforeSend;
    const event = {
      request: {
        headers: { authorization: 'Bearer secret', cookie: 'sid=abc' },
        cookies: 'sid=abc',
        data: { password: 'p', email: 'a@b.com', nested: { token: 't' } },
      },
      user: { id: 'u1', email: 'a@b.com', ip_address: '1.2.3.4' },
      extra: { password: 'p', access_token: 'a', refresh_token: 'r', secret: 's', safe: 'ok' },
    };
    const out = beforeSend(event);
    expect(out!.request!.headers!.authorization).toBe('[Filtered]');
    expect(out!.request!.headers!.cookie).toBe('[Filtered]');
    expect(out!.request!.cookies).toBeUndefined();
    expect((out!.request!.data as Record<string, unknown>).password).toBe('[Filtered]');
    expect((out!.request!.data as Record<string, unknown>).email).toBe('a@b.com');
    expect(((out!.request!.data as Record<string, unknown>).nested as Record<string, unknown>).token).toBe('[Filtered]');
    expect(out!.user!.email).toBeUndefined();
    expect(out!.user!.ip_address).toBeUndefined();
    expect(out!.user!.id).toBe('u1');
    expect((out!.extra as Record<string, unknown>).password).toBe('[Filtered]');
    expect((out!.extra as Record<string, unknown>).access_token).toBe('[Filtered]');
    expect((out!.extra as Record<string, unknown>).refresh_token).toBe('[Filtered]');
    expect((out!.extra as Record<string, unknown>).secret).toBe('[Filtered]');
    expect((out!.extra as Record<string, unknown>).safe).toBe('ok');
  });
});