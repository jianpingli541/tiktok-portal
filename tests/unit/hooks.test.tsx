import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTasks } from '@/hooks/useTasks';
import { useTokenStore } from '@/lib/auth/token';

beforeEach(() => {
  vi.restoreAllMocks();
  useTokenStore.setState({ session: null });
});

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useTasks', () => {
  it('fetches tasks list', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 })),
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toEqual([]);
  });
});
