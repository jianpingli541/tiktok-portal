import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { SubscriptionDTO } from '@/lib/api/types';
import { useTokenStore } from '@/lib/auth/token';

function authHeaders(): Record<string, string> {
  const token = useTokenStore.getState().session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useCurrentSubscription() {
  return useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: () =>
      apiClient.get<SubscriptionDTO>('/v1/subscriptions/current', { headers: authHeaders() }),
  });
}

export function useUpgradeSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan_id: string) =>
      apiClient.post<SubscriptionDTO>('/v1/subscriptions/upgrade', { plan_id }, { headers: authHeaders() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription'] }),
  });
}

export interface CheckoutSessionResponse {
  url: string;
  session_id: string;
}

export interface CheckoutSessionInput {
  plan_id: string;
  success_path: string;
  cancel_path: string;
}

/**
 * Create a Stripe Checkout Session and return its hosted URL. We deliberately
 * do NOT invalidate the subscription query here — the source of truth is the
 * Stripe webhook landing on the backend. Invalidate on the return page once
 * `useBillingReturn` confirms payment_status === 'paid'.
 */
export function useCreateCheckoutSession() {
  return useMutation<CheckoutSessionResponse, Error, CheckoutSessionInput>({
    mutationFn: ({ plan_id, success_path, cancel_path }) =>
      apiClient.post<CheckoutSessionResponse>(
        '/v1/billing/checkout-session',
        { plan_id, success_path, cancel_path },
        { headers: authHeaders() },
      ),
  });
}

export interface BillingReturnResponse {
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  subscription?: SubscriptionDTO;
}

/**
 * Look up the result of a Stripe Checkout Session for the success page.
 * Read-only; the backend treats this as a display query — the webhook is
 * still the authoritative source for subscription state.
 */
export function useBillingReturn(sessionId: string | null) {
  return useQuery<BillingReturnResponse>({
    queryKey: ['billing', 'return', sessionId],
    queryFn: () =>
      apiClient.get<BillingReturnResponse>(
        `/v1/billing/return?session_id=${encodeURIComponent(sessionId ?? '')}`,
        { headers: authHeaders() },
      ),
    enabled: !!sessionId,
    retry: false,
  });
}
