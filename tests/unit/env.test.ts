import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('env', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses valid env', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('VITE_ENABLE_MOCK', 'true');
    const { env } = await import('@/lib/env');
    expect(env.VITE_API_BASE_URL).toBe('https://api.example.com');
    expect(env.VITE_ENABLE_MOCK).toBe(true);
  });

  it('rejects non-url base', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'not-a-url');
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    const { getEnv } = await import('@/lib/env');
    expect(() => getEnv()).toThrow();
  });

  it('coerces VITE_ENABLE_MOCK string to boolean', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    const { env } = await import('@/lib/env');
    expect(env.VITE_ENABLE_MOCK).toBe(false);
  });
});