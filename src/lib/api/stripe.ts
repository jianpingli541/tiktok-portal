import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { env } from '@/lib/env';

/**
 * Single Stripe.js loader — `@stripe/stripe-js` returns the same promise on
 * repeated calls, but caching our own reference keeps the import surface
 * small and makes the lazy init explicit.
 */
let stripePromise: Promise<Stripe | null> | null = null;

function getStripe(): Promise<Stripe | null> {
  const key = env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    // Missing pk_ is a configuration error in production. In dev/tests we
    // still resolve to null so callers can render gracefully.
    return Promise.resolve(null);
  }
  if (!stripePromise) {
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

export { getStripe };

/**
 * Hosted Checkout redirect. The backend creates a `Checkout Session` and
 * returns its `url`; we send the browser there. The session itself does the
 * card collection + 3DS + return-URL handling, so we never touch PAN data.
 */
export function redirectToCheckout(sessionUrl: string): void {
  window.location.href = sessionUrl;
}