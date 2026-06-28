import { useCallback } from 'react';
import { apiClient, setOnUnauthorized } from '@/lib/api/client';
import { useTokenStore } from './token';
import type { AuthSession } from '@/lib/api/types';

export function useAuth() {
  const session = useTokenStore((s) => s.session);
  const setSession = useTokenStore((s) => s.setSession);
  const clear = useTokenStore((s) => s.clear);

  const login = useCallback(
    async (email: string, password: string) => {
      const s = await apiClient.post<AuthSession>('/v1/auth/login', { email, password });
      setSession(s);
      return s;
    },
    [setSession],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const s = await apiClient.post<AuthSession>('/v1/auth/register', { email, password });
      setSession(s);
      return s;
    },
    [setSession],
  );

  const refresh = useCallback(async () => {
    if (!session?.refresh_token) throw new Error('no refresh token');
    const s = await apiClient.post<AuthSession>('/v1/auth/refresh', {
      refresh_token: session.refresh_token,
    });
    setSession(s);
    return s;
  }, [session?.refresh_token, setSession]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/v1/auth/logout');
    } finally {
      clear();
    }
  }, [clear]);

  const installUnauthorizedHandler = useCallback(() => {
    setOnUnauthorized(async () => {
      try {
        await refresh();
      } catch {
        clear();
      }
    });
  }, [refresh, clear]);

  return { session, login, register, refresh, logout, installUnauthorizedHandler };
}
