import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlans } from '@/hooks/usePlans';
import {
  useCurrentSubscription,
  useUpgradeSubscription,
  useCreateCheckoutSession,
} from '@/hooks/useSubscriptions';
import { redirectToCheckout } from '@/lib/api/stripe';
import { env } from '@/lib/env';
import { ApiError } from '@/lib/api/errors';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Billing() {
  const { t } = useTranslation();
  const { data: plans } = usePlans();
  const { data: current } = useCurrentSubscription();
  const upgrade = useUpgradeSubscription();
  const checkout = useCreateCheckoutSession();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stripeEnabled = env.VITE_STRIPE_ENABLED;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card>
        <CardHeader><CardTitle>{t('billing.currentPlan')}</CardTitle></CardHeader>
        <CardContent>
          {current ? (
            <div className="flex items-center gap-3">
              <Badge>{current.plan_id}</Badge>
              <span className="text-sm text-muted-foreground">
                {t('billing.renews', { date: new Date(current.current_period_end).toLocaleDateString() })}
              </span>
            </div>
          ) : (
            <p>{t('common.loading')}</p>
          )}
        </CardContent>
      </Card>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMsg}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {plans?.map((p: { id: string; name: string; price_cents: number; monthly_quota: number }) => (
          <Card key={p.id} className={current?.plan_id === p.id ? 'border-primary' : ''}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <div className="text-2xl font-bold">
                ¥{(p.price_cents / 100).toFixed(0)}{t('pricing.perMonth')}
              </div>
            </CardHeader>
            <CardContent>{t('billing.videosPerMonth', { count: p.monthly_quota })}</CardContent>
            <CardFooter>
              <Button
                disabled={current?.plan_id === p.id || upgrade.isPending || checkout.isPending}
                onClick={() => {
                  setErrorMsg(null);
                  if (!stripeEnabled) {
                    upgrade.mutate(p.id);
                    return;
                  }
                  checkout.mutate(
                    { plan_id: p.id, success_path: '/billing/return', cancel_path: '/billing' },
                    {
                      onSuccess: ({ url }) => redirectToCheckout(url),
                      onError: (e) =>
                        setErrorMsg(e instanceof ApiError ? e.message : t('errors.something_went_wrong')),
                    },
                  );
                }}
                className="w-full"
              >
                {current?.plan_id === p.id
                  ? t('common.current')
                  : checkout.isPending
                    ? t('billing.openingCheckout')
                    : t('pricing.choose', { plan: p.name })}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
