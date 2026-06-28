import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePlans } from '@/hooks/usePlans';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Pricing() {
  const { t } = useTranslation();
  const { data: plans, isLoading, error } = usePlans();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="mb-8 text-center text-4xl font-bold">{t('pricing.title')}</h1>
      {isLoading && <p className="text-center">{t('common.loading')}</p>}
      {error && <p className="text-center text-red-500">{t('errors.plans_load_failed')}</p>}
      <div className="grid gap-6 md:grid-cols-3">
        {plans?.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <div className="text-3xl font-bold">
                ¥{(p.price_cents / 100).toFixed(0)}
                <span className="text-sm font-normal text-muted-foreground">{t('pricing.perMonth')}</span>
              </div>
            </CardHeader>
            <CardContent>
              <p>{t('pricing.videosPerMonth', { count: p.monthly_quota })}</p>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link to={`/register?plan=${p.id}`}>{t('pricing.choose', { plan: p.name })}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
