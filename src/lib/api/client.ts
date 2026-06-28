import { env } from '@/lib/env';
import { reportApiError } from '@/lib/observability';
import { ApiError } from './errors';

type OnUnauthorized = () => Promise<void>;
let onUnauthorized: OnUnauthorized | null = null;

export function setOnUnauthorized(cb: OnUnauthorized | null): void {
  onUnauthorized = cb;
}

interface RequestInit_ extends Omit<globalThis.RequestInit, 'body'> {
  body?: unknown;
  retry?: boolean;
  timeoutMs?: number;
}

async function request<T>(path: string, init: RequestInit_ = {}): Promise<T> {
  const { body, retry = true, timeoutMs = 15000, headers, ...rest } = init;
  const method = (rest.method as string | undefined) ?? 'GET';
  const url = `${env.VITE_API_BASE_URL}${path}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { 'Content-Type': 'application/json', ...(headers as Record<string, string>) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(t);
    if (retry) return request<T>(path, { ...init, retry: false });
    const err = new ApiError(0, 'NETWORK_ERROR', (e as Error).message);
    reportApiError(err, { path, method, status: 0 });
    throw err;
  }
  clearTimeout(t);

  if (res.status === 401 && onUnauthorized) {
    await onUnauthorized();
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const err = new ApiError(
      res.status,
      data?.code ?? `HTTP_${res.status}`,
      data?.message ?? res.statusText,
      data,
    );
    // Only 5xx are bugs/infrastructure issues worth reporting. 4xx are user
    // errors (validation, auth, not-found) and 401 is handled by onUnauthorized.
    if (res.status >= 500) {
      reportApiError(err, { path, method, status: res.status });
    }
    throw err;
  }
  return data as T;
}

export const apiClient = {
  get: <T>(path: string, init?: RequestInit_) => request<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: RequestInit_) =>
    request<T>(path, { ...init, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, init?: RequestInit_) =>
    request<T>(path, { ...init, method: 'PUT', body }),
  delete: <T>(path: string, init?: RequestInit_) => request<T>(path, { ...init, method: 'DELETE' }),
};