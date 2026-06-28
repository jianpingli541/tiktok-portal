import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '@/lib/auth/useAuth';
import { useTokenStore } from '@/lib/auth/token';

beforeEach(() => {
  useTokenStore.setState({ session: null });
  vi.restoreAllMocks();
});

describe('useAuth', () => {
  it('login sets session', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            user: { id: '1', email: 'a@b.c' },
            access_token: 'a',
            refresh_token: 'r',
            expires_at: '2030-01-01',
          }),
        ),
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.login('a@b.c', 'pw');
    });
    expect(result.current.session?.user.email).toBe('a@b.c');
  });
});
