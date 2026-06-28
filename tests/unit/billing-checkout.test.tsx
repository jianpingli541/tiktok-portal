import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useTokenStore } from '@/lib/auth/token';

// Initialise i18n so useTranslation inside Billing resolves.
import '@/lib/i18n';

// Enable Stripe path before any module reads env (env is cached on first parse).
vi.stubEnv('VITE_STRIPE_ENABLED', 'true');
vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_dummy');

vi.mock('@/lib/api/stripe', () => ({
  redirectToCheckout: vi.fn(),
  getStripe: vi.fn(),
}));

import { redirectToCheckout } from '@/lib/api/stripe';
import Billing from '@/app/(account)/Billing';

const redirectMock = vi.mocked(redirectToCheckout);

const originalFetch = global.fetch;

beforeAll(() => {
  // jsdom defaults to `about:blank` (opaque origin) which blocks
  // localStorage access. Point at a real origin so i18n's detector works.
  try {
    window.location.href = 'http://localhost/';
  } catch {
    /* ignore */
  }
});

beforeEach(() => {
  vi.restoreAllMocks();
  redirectMock.mockReset();
  useTokenStore.setState({
    session: { user: { id: 'u1', email: 'a@b.c' }, access_token: 'tok', refresh_token: 'r', expires_at: '2099-01-01' },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const PLAN = { id: 'pro_monthly', name: 'Pro', price_cents: 9900, currency: 'CNY', monthly_quota: 100 };
const CURRENT = { plan_id: 'basic', status: 'active', current_period_end: '2026-07-28T00:00:00Z' };

type FetchMock = ReturnType<typeof vi.fn>;

function plansResponse(): Response {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify([PLAN])),
  } as Response;
}

function currentResponse(): Response {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(CURRENT)),
  } as Response;
}

function checkoutOkResponse(): Response {
  return {
    ok: true,
    status: 200,
    text: () =>
      Promise.resolve(
        JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/cs_test_x', session_id: 'cs_test_x' }),
      ),
  } as Response;
}

function checkoutErrorResponse(status = 402, message = 'Already on higher tier'): Response {
  return {
    ok: false,
    status,
    statusText: 'Error',
    text: () => Promise.resolve(JSON.stringify({ code: 'QUOTA_EXCEEDED', message })),
  } as Response;
}

describe('Billing — Stripe checkout flow', () => {
  it('calls createCheckoutSession and redirects on success', async () => {
    let lastCheckoutBody: unknown = null;
    const fetchMock: FetchMock = vi.fn().mockImplementation((url: string, init?: { body?: unknown }) => {
      const u = String(url);
      if (u.endsWith('/v1/plans')) return Promise.resolve(plansResponse());
      if (u.endsWith('/v1/subscriptions/current')) return Promise.resolve(currentResponse());
      if (u.endsWith('/v1/billing/checkout-session')) {
        lastCheckoutBody = init?.body ? JSON.parse(String(init.body)) : null;
        return Promise.resolve(checkoutOkResponse());
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') } as Response);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<Billing />, { wrapper });

    const choose = await screen.findByRole('button', { name: /choose/i });
    await user.click(choose);

    await waitFor(() =>
      expect(redirectMock).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_x'),
    );
    expect(lastCheckoutBody).toEqual({
      plan_id: 'pro_monthly',
      success_path: '/billing/return',
      cancel_path: '/billing',
    });
  });

  it('shows ApiError message when checkout mutation fails', async () => {
    const fetchMock: FetchMock = vi.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/v1/plans')) return Promise.resolve(plansResponse());
      if (u.endsWith('/v1/subscriptions/current')) return Promise.resolve(currentResponse());
      if (u.endsWith('/v1/billing/checkout-session')) return Promise.resolve(checkoutErrorResponse());
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') } as Response);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<Billing />, { wrapper });

    const choose = await screen.findByRole('button', { name: /choose/i });
    await user.click(choose);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Already on higher tier');
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('disables button while checkout mutation is pending', async () => {
    let resolveCheckout!: (v: Response) => void;
    const fetchMock: FetchMock = vi.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/v1/plans')) return Promise.resolve(plansResponse());
      if (u.endsWith('/v1/subscriptions/current')) return Promise.resolve(currentResponse());
      if (u.endsWith('/v1/billing/checkout-session')) {
        return new Promise<Response>((resolve) => {
          resolveCheckout = resolve;
        });
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') } as Response);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<Billing />, { wrapper });

    const choose = await screen.findByRole('button', { name: /choose/i });
    await user.click(choose);

    const openingBtn = await screen.findByRole('button', { name: /opening checkout/i });
    expect(openingBtn).toBeDisabled();

    resolveCheckout(checkoutOkResponse());
  });
});