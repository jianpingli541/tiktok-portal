import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BillingReturn from '@/app/(account)/BillingReturn';
import { useTokenStore } from '@/lib/auth/token';

import '@/lib/i18n';

beforeAll(() => {
  try {
    window.location.href = 'http://localhost/';
  } catch {
    /* ignore */
  }
});

const originalFetch = global.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
  useTokenStore.setState({
    session: { user: { id: 'u1', email: 'a@b.c' }, access_token: 'tok', refresh_token: 'r', expires_at: '2099-01-01' },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

function wrapper({ initialEntries }: { initialEntries: string[] }) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/billing/return" element={children} />
            <Route path="/billing" element={<div>Billing Page</div>} />
            <Route path="/tasks" element={<div>Tasks Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('BillingReturn', () => {
  it('shows missing session message when no session_id in URL', async () => {
    const Wrapper = wrapper({ initialEntries: ['/billing/return'] });
    render(<BillingReturn />, { wrapper: Wrapper });
    expect(await screen.findByText(/missing session/i)).toBeInTheDocument();
  });

  it('shows loading state while fetching', async () => {
    let resolve!: (v: Response) => void;
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    ) as unknown as typeof fetch;

    const Wrapper = wrapper({ initialEntries: ['/billing/return?session_id=cs_test_x'] });
    render(<BillingReturn />, { wrapper: Wrapper });
    expect(await screen.findByText(/confirming your payment/i)).toBeInTheDocument();
    resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') } as Response);
  });

  it('shows success and navigates to /tasks on payment_status=paid', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/v1/billing/return')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                payment_status: 'paid',
                subscription: { plan_id: 'pro_monthly', status: 'active', current_period_end: '2026-07-28T00:00:00Z' },
              }),
            ),
        });
      }
      // useCurrentSubscription also runs on mount (via refetch effect)
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    }) as unknown as typeof fetch;

    const Wrapper = wrapper({ initialEntries: ['/billing/return?session_id=cs_test_paid'] });
    render(<BillingReturn />, { wrapper: Wrapper });

    expect(await screen.findByText(/payment successful/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /go to tasks/i }));
    await waitFor(() => expect(screen.getByText('Tasks Page')).toBeInTheDocument());
  });

  it('shows try-again UI on payment_status=unpaid', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/v1/billing/return')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ payment_status: 'unpaid' })),
        });
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    }) as unknown as typeof fetch;

    const Wrapper = wrapper({ initialEntries: ['/billing/return?session_id=cs_test_unpaid'] });
    render(<BillingReturn />, { wrapper: Wrapper });

    expect(await screen.findByText(/payment not completed/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByText('Billing Page')).toBeInTheDocument());
  });

  it('shows session-expired message on 404', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/v1/billing/return')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: () => Promise.resolve(JSON.stringify({ code: 'SESSION_NOT_FOUND', message: 'expired' })),
        });
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    }) as unknown as typeof fetch;

    const Wrapper = wrapper({ initialEntries: ['/billing/return?session_id=cs_test_gone'] });
    render(<BillingReturn />, { wrapper: Wrapper });

    expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
  });
});