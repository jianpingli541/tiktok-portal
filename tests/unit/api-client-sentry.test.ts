import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock observability so we can spy on reportApiError without booting Sentry.
// The mock is registered once at file load; mockClear() resets call history
// between tests inside beforeEach.
vi.mock('@/lib/observability', () => ({
  reportApiError: vi.fn(),
  initObservability: vi.fn(),
  Sentry: {
    ErrorBoundary: ({ children }: { children: React.ReactNode }) =>
      children as React.ReactElement,
  },
}));

const originalFetch = global.fetch;

describe('apiClient Sentry reporting', () => {
  beforeEach(async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    vi.stubEnv('VITE_SENTRY_ENABLED', 'true');
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@example.ingest.sentry.io/1');
    // Reset reportApiError mock call history between tests.
    // Note: NOT using vi.resetModules() — that would force fresh module
    // evaluation of `@/lib/api/errors` and break the ApiError instanceof
    // check below.
    const { reportApiError } = await import('@/lib/observability');
    (reportApiError as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('reports NETWORK_ERROR to Sentry when fetch fails after retry', async () => {
    const errorsModule = await import('@/lib/api/errors');
    const { apiClient } = await import('@/lib/api/client');
    const { reportApiError } = await import('@/lib/observability');
    const ApiError = errorsModule.ApiError;
    global.fetch = vi.fn().mockRejectedValue(new TypeError('NetworkError'));

    await expect(apiClient.get('/x')).rejects.toBeInstanceOf(ApiError);
    expect(reportApiError).toHaveBeenCalledOnce();
    const [err, extra] = (reportApiError as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(err).toBeInstanceOf(ApiError);
    expect((err as InstanceType<typeof ApiError>).code).toBe('NETWORK_ERROR');
    expect(extra).toMatchObject({ path: '/x', method: 'GET', status: 0 });
  });

  it('reports 500 errors to Sentry', async () => {
    const errorsModule = await import('@/lib/api/errors');
    const { apiClient } = await import('@/lib/api/client');
    const { reportApiError } = await import('@/lib/observability');
    const ApiError = errorsModule.ApiError;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: () => Promise.resolve(JSON.stringify({ code: 'INTERNAL', message: 'boom' })),
    });

    await expect(apiClient.get('/x')).rejects.toBeInstanceOf(ApiError);
    expect(reportApiError).toHaveBeenCalledOnce();
    const [err, extra] = (reportApiError as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((err as InstanceType<typeof ApiError>).status).toBe(500);
    expect(extra).toMatchObject({ path: '/x', method: 'GET', status: 500 });
  });

  it('does NOT report 400 errors to Sentry', async () => {
    const errorsModule = await import('@/lib/api/errors');
    const { apiClient } = await import('@/lib/api/client');
    const { reportApiError } = await import('@/lib/observability');
    const ApiError = errorsModule.ApiError;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: () => Promise.resolve(JSON.stringify({ code: 'BAD', message: 'no' })),
    });

    await expect(apiClient.get('/x')).rejects.toBeInstanceOf(ApiError);
    expect(reportApiError).not.toHaveBeenCalled();
  });

  it('does NOT report 401 errors to Sentry (handled by onUnauthorized)', async () => {
    const errorsModule = await import('@/lib/api/errors');
    const { apiClient, setOnUnauthorized } = await import('@/lib/api/client');
    const { reportApiError } = await import('@/lib/observability');
    const ApiError = errorsModule.ApiError;
    setOnUnauthorized(() => Promise.resolve());
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('{}'),
    });

    await expect(apiClient.get('/x')).rejects.toBeInstanceOf(ApiError);
    expect(reportApiError).not.toHaveBeenCalled();
  });

  it('does NOT report 404 errors to Sentry', async () => {
    const errorsModule = await import('@/lib/api/errors');
    const { apiClient } = await import('@/lib/api/client');
    const { reportApiError } = await import('@/lib/observability');
    const ApiError = errorsModule.ApiError;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve('{}'),
    });

    await expect(apiClient.get('/x')).rejects.toBeInstanceOf(ApiError);
    expect(reportApiError).not.toHaveBeenCalled();
  });
});