import { http, HttpResponse } from 'msw';
import { plansFixture } from '../fixtures/plans';
import type { SubscriptionDTO } from '@/lib/api/types';

export const planHandlers = [
  http.get('/v1/plans', () => HttpResponse.json(plansFixture)),
  http.get('/v1/subscriptions/current', () =>
    HttpResponse.json({ plan_id: 'free', status: 'active', current_period_end: '2030-01-01' } satisfies SubscriptionDTO),
  ),
  http.post('/v1/subscriptions/upgrade', async ({ request }) => {
    const body = (await request.json()) as { plan_id: string };
    return HttpResponse.json({ plan_id: body.plan_id, status: 'active', current_period_end: '2030-01-01' });
  }),
];
