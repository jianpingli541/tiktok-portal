import * as Sentry from '@sentry/react';
import { getEnv } from '@/lib/env';
import type { ConsentState } from '@/lib/consent';

const DENY_REQUEST_HEADERS = new Set(['cookie', 'authorization']);
const DENY_USER_KEYS = new Set(['email', 'ip_address', 'username']);
const DENY_EXTRA_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'secret',
]);

function scrubObject<T>(input: T, denyKeys: Set<string>): T {
  if (input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    return input.map((item) => scrubObject(item, denyKeys)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (denyKeys.has(key.toLowerCase())) {
      out[key] = '[Filtered]';
    } else if (value && typeof value === 'object') {
      out[key] = scrubObject(value, denyKeys);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

function beforeSend(event: Sentry.ErrorEvent, _hint: Sentry.EventHint): Sentry.ErrorEvent | null {
  try {
    if (event.request) {
      if (event.request.headers) {
        const headers = event.request.headers as Record<string, string>;
        for (const key of Object.keys(headers)) {
          if (DENY_REQUEST_HEADERS.has(key.toLowerCase())) {
            headers[key] = '[Filtered]';
          }
        }
      }
      if (event.request.cookies !== undefined) {
        event.request.cookies = undefined;
      }
      if (event.request.data && typeof event.request.data === 'object') {
        event.request.data = scrubObject(event.request.data, DENY_EXTRA_KEYS);
      }
    }
    if (event.user) {
      const user = event.user as Record<string, unknown>;
      for (const key of Object.keys(user)) {
        if (DENY_USER_KEYS.has(key.toLowerCase())) {
          delete user[key];
        }
      }
    }
    if (event.extra && typeof event.extra === 'object') {
      event.extra = scrubObject(event.extra, DENY_EXTRA_KEYS);
    }
    return event;
  } catch {
    // Defensive: never let scrub logic crash the SDK.
    return event;
  }
}

/**
 * Compute Sentry init options from the current consent state.
 *
 *  - `necessary` cookies are always on (auth/session).
 *  - `analytics` gates tracing: 0 if denied, 0.1 in prod / 1.0 in dev if granted.
 *  - `marketing` is reserved for future marketing-pixel integrations; replays
 *    stay at zero by default (PII risk) and are only enabled when analytics
 *    is granted.
 *  - `decidedAt === null` means the user has not yet chosen; treat analytics
 *    and marketing as denied until they do (GDPR "no implicit consent").
 */
function buildOptions(consent: ConsentState): Sentry.BrowserOptions | null {
  // Re-read env on every call so tests using vi.stubEnv() can flip the
  // VITE_SENTRY_ENABLED / DSN values between tests without invalidating
  // the cached env object.
  const env = getEnv();
  if (!env.VITE_SENTRY_ENABLED || !env.VITE_SENTRY_DSN) return null;

  const isDev = env.VITE_SENTRY_ENVIRONMENT === 'development';
  const analyticsOn = consent.analytics && consent.decidedAt !== null;
  const tracesSampleRate = analyticsOn ? (isDev ? 1.0 : 0.1) : 0;
  const replaysOnErrorSampleRate = analyticsOn ? (isDev ? 1.0 : 0.1) : 0;

  return {
    dsn: env.VITE_SENTRY_DSN,
    environment: env.VITE_SENTRY_ENVIRONMENT,
    release: env.VITE_SENTRY_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate,
    beforeSend,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate,
  };
}

/**
 * Initialize Sentry. No-op unless VITE_SENTRY_ENABLED === true AND DSN is set.
 *
 * Called once at app boot (before MSW, before React). Uses the consent state
 * already on disk; if the user has not yet decided, analytics tracing and
 * replays are disabled. Re-call `reinitObservability(consent)` once the user
 * makes a choice.
 *
 * Safe to call repeatedly — closes the prior client before re-init.
 */
export function initObservability(consent?: ConsentState): void {
  try {
    // Defensive default when called without args (e.g. legacy callers).
    const c: ConsentState =
      consent ?? {
        necessary: true,
        analytics: false,
        marketing: false,
        decidedAt: null,
      };
    const opts = buildOptions(c);
    if (!opts) return;
    // close() may throw if no client is active; guard so re-init is safe.
    try { Sentry.close(); } catch { /* no prior client */ }
    Sentry.init(opts);
  } catch (e) {
    // Sentry SDK must never break the app.
    console.warn('[observability] Sentry init failed:', e);
  }
}

/**
 * Re-init Sentry after the user updates their consent preferences.
 * Idempotent and safe to call repeatedly.
 */
export function reinitObservability(consent: ConsentState): void {
  initObservability(consent);
}

/** Manually capture an error (used by API client for 5xx + NETWORK_ERROR). */
export function reportApiError(err: unknown, extra?: Record<string, unknown>): void {
  if (!getEnv().VITE_SENTRY_ENABLED) return;
  Sentry.captureException(err, { extra });
}

/** Re-export Sentry namespace so call sites don't need a direct dep. */
export { Sentry };
