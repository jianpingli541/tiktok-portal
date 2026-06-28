import { http, HttpResponse } from 'msw';
import type { AuthSession } from '@/lib/api/types';

export const authHandlers = [
  http.post('/v1/auth/register', async () => {
    const body: AuthSession = {
      user: { id: 'u1', email: 'new@user.com' },
      access_token: 'mock-access',
      refresh_token: 'mock-refresh',
      expires_at: new Date(Date.now() + 7200_000).toISOString(),
    };
    return HttpResponse.json(body, { status: 201 });
  }),
  http.post('/v1/auth/login', async () => {
    const body: AuthSession = {
      user: { id: 'u1', email: 'a@b.c' },
      access_token: 'mock-access',
      refresh_token: 'mock-refresh',
      expires_at: new Date(Date.now() + 7200_000).toISOString(),
    };
    return HttpResponse.json(body);
  }),
  http.post('/v1/auth/refresh', async () =>
    HttpResponse.json({
      user: { id: 'u1', email: 'a@b.c' },
      access_token: 'mock-access-2',
      refresh_token: 'mock-refresh-2',
      expires_at: new Date(Date.now() + 7200_000).toISOString(),
    }),
  ),
  http.post('/v1/auth/logout', () => new HttpResponse(null, { status: 204 })),
];
