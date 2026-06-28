import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Terms() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{t('terms.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('terms.lastUpdated', { date: '2026-06-28' })}
        </p>
        <p className="text-base">{t('terms.intro')}</p>
        <p className="text-xs italic text-muted-foreground">{t('terms.legalReview')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('terms.service.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('terms.service.body')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('terms.userObligations.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ul className="list-disc space-y-1 pl-6">
            <li>{t('terms.userObligations.items.account')}</li>
            <li>{t('terms.userObligations.items.lawful')}</li>
            <li>{t('terms.userObligations.items.content')}</li>
            <li>{t('terms.userObligations.items.noAbuse')}</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('terms.ip.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('terms.ip.body')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('terms.disclaimer.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('terms.disclaimer.body')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('terms.liability.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('terms.liability.body')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('terms.termination.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('terms.termination.body')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('terms.law.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('terms.law.body')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
