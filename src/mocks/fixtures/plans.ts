import type { PlanDTO } from '@/lib/api/types';

export const plansFixture: PlanDTO[] = [
  { id: 'free', name: 'Free', price_cents: 0, currency: 'CNY', monthly_quota: 5 },
  { id: 'pro', name: 'Pro', price_cents: 9900, currency: 'CNY', monthly_quota: 100 },
  { id: 'business', name: 'Business', price_cents: 89900, currency: 'CNY', monthly_quota: 1000 },
];
