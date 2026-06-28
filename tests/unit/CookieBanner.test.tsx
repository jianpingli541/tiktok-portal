import { describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import CookieBanner from '@/components/CookieBanner';
import { useConsentStore } from '@/stores/consent';

function Probe() {
  const state = useConsentStore((s) => s.state);
  return (
    <div data-testid="probe-state">
      {JSON.stringify({
        analytics: state.analytics,
        marketing: state.marketing,
        decidedAt: state.decidedAt,
      })}
    </div>
  );
}

function renderBanner() {
  return render(
    <I18nextProvider i18n={i18n}>
      <CookieBanner />
      <Probe />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  // Reset store + storage before every test.
  useConsentStore.setState({
    state: { necessary: true, analytics: false, marketing: false, decidedAt: null },
    isOpen: false,
  });
  window.localStorage.clear();
  document.cookie = 'tiktok-portal-consent=; Max-Age=0; path=/';
  // The banner uses react-i18next — make sure the instance is ready.
  // The lib init is synchronous in tests because i18n.init returns a promise
  // we can't await at module-eval time; components tolerate undefined keys.
  if (!i18n.isInitialized) {
    // No-op; tests use t() fallbacks to keys when not initialized.
  }
});

describe('CookieBanner', () => {
  it('renders the banner by default when the user has not decided', () => {
    renderBanner();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/We respect your privacy/i)).toBeInTheDocument();
  });

  it('hides the banner once the user has decided', () => {
    useConsentStore.setState({
      state: {
        necessary: true,
        analytics: true,
        marketing: true,
        decidedAt: new Date().toISOString(),
      },
      isOpen: false,
    });
    renderBanner();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('accept all toggles analytics+marketing on and persists to localStorage', async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.click(screen.getByRole('button', { name: /accept all/i }));
    const probe = JSON.parse(screen.getByTestId('probe-state').textContent || '{}');
    expect(probe.analytics).toBe(true);
    expect(probe.marketing).toBe(true);
    expect(probe.decidedAt).not.toBeNull();
    expect(window.localStorage.getItem('tiktok-portal-consent')).not.toBeNull();
  });

  it('reject all keeps analytics+marketing off and persists decidedAt', async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.click(screen.getByRole('button', { name: /reject all/i }));
    const probe = JSON.parse(screen.getByTestId('probe-state').textContent || '{}');
    expect(probe.analytics).toBe(false);
    expect(probe.marketing).toBe(false);
    expect(probe.decidedAt).not.toBeNull();
  });

  it('expanded view shows per-category checkboxes that can be toggled and saved', async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.click(screen.getByRole('button', { name: /customize/i }));
    const analytics = screen.getByTestId('cookie-analytics') as HTMLInputElement;
    const marketing = screen.getByTestId('cookie-marketing') as HTMLInputElement;
    fireEvent.click(analytics);
    fireEvent.click(marketing);
    expect(analytics.checked).toBe(true);
    expect(marketing.checked).toBe(true);
    await user.click(screen.getByTestId('cookie-save'));
    const probe = JSON.parse(screen.getByTestId('probe-state').textContent || '{}');
    expect(probe.analytics).toBe(true);
    expect(probe.marketing).toBe(true);
    expect(probe.decidedAt).not.toBeNull();
  });
});
