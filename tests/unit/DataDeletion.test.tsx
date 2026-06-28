import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import DataDeletion from '@/app/(legal)/DataDeletion';
import { useTokenStore } from '@/lib/auth/token';

// Stub ApiError so we don't have to import the class directly.
vi.mock('@/lib/api/errors', () => {
  return {
    ApiError: class ApiError extends Error {
      status: number;
      code: string;
      data: unknown;
      constructor(status: number, code: string, message: string, data?: unknown) {
        super(message);
        this.status = status;
        this.code = code;
        this.data = data;
      }
    },
  };
});

beforeAll(() => {
  // Provide a non-opaque origin so jsdom's URL parsing works in tests that
  // touch location-based things.
  try {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, origin: 'http://localhost', href: 'http://localhost/' },
      writable: true,
    });
  } catch {
    /* ignore */
  }
});

const originalFetch = global.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
  useTokenStore.setState({
    session: {
      user: { id: 'u1', email: 'user@example.com' },
      access_token: 'tok',
      refresh_token: 'r',
      expires_at: '2099-01-01',
    },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <DataDeletion />
    </I18nextProvider>,
  );
}

describe('DataDeletion', () => {
  it('renders the warning, the form, and the destructive submit button', () => {
    renderPage();
    expect(screen.getByText(/irreversible/i)).toBeInTheDocument();
    expect(screen.getByTestId('deletion-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('deletion-submit')).toBeInTheDocument();
  });

  it('calls POST /v1/auth/delete-data with the confirmation_email', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: async () =>
        JSON.stringify({
          request_id: 'dlt_01HXYZ',
          scheduled_for: '2026-07-28T12:00:00Z',
        }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    renderPage();
    const emailInput = screen.getByTestId('deletion-email-input');
    await user.clear(emailInput);
    await user.type(emailInput, 'user@example.com');
    await user.click(screen.getByTestId('deletion-submit'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, globalThis.RequestInit];
    expect(url).toBe('https://api.example.com/v1/auth/delete-data');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({ confirmation_email: 'user@example.com' });
  });

  it('renders the success card after a 202 response', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: async () =>
        JSON.stringify({
          request_id: 'dlt_01HXYZ',
          scheduled_for: '2026-07-28T12:00:00Z',
        }),
    }) as unknown as typeof fetch;

    renderPage();
    const emailInput = screen.getByTestId('deletion-email-input');
    await user.clear(emailInput);
    await user.type(emailInput, 'user@example.com');
    await user.click(screen.getByTestId('deletion-submit'));

    const success = await screen.findByTestId('deletion-success');
    expect(success).toBeInTheDocument();
    expect(success.textContent).toContain('dlt_01HXYZ');
  });

  it('renders an inline error when the API call fails', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ code: 'UNAUTHENTICATED', message: 'nope' }),
    }) as unknown as typeof fetch;

    renderPage();
    const emailInput = screen.getByTestId('deletion-email-input');
    await user.clear(emailInput);
    await user.type(emailInput, 'user@example.com');
    await user.click(screen.getByTestId('deletion-submit'));

    const err = await screen.findByTestId('deletion-error');
    expect(err).toBeInTheDocument();
    expect(screen.queryByTestId('deletion-success')).not.toBeInTheDocument();
  });
});
