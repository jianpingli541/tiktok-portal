import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient, setOnUnauthorized } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  setOnUnauthorized(null);
});

describe('apiClient', () => {
  it('returns parsed json on 200', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ hello: 'world' })),
    });
    const data = await apiClient.get<{ hello: string }>('/x');
    expect(data.hello).toBe('world');
  });

  it('throws ApiError on 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: () => Promise.resolve(JSON.stringify({ code: 'INTERNAL', message: 'boom' })),
    });
    await expect(apiClient.get('/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('invokes onUnauthorized on 401', async () => {
    const cb = vi.fn().mockResolvedValue(undefined);
    setOnUnauthorized(cb);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('{}'),
    });
    await expect(apiClient.get('/x')).rejects.toBeInstanceOf(ApiError);
    expect(cb).toHaveBeenCalledOnce();
  });
});
