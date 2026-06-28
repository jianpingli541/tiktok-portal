import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Refund() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{t('refund.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('refund.lastUpdated', { date: '2026-06-28' })}
        </p>
        <p className="text-base">{t('refund.intro')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('refund.policy.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{t('refund.policy.body')}</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>{t('refund.policy.items.sevenDays')}</li>
            <li>{t('refund.policy.items.proRata')}</li>
            <li>{t('refund.policy.items.credits')}</li>
            <li>{t('refund.policy.items.exclusions')}</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('refund.process.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{t('refund.process.body')}</p>
          <ol className="list-decimal space-y-1 pl-6">
            <li>{t('refund.process.steps.email')}</li>
            <li>{t('refund.process.steps.review')}</li>
            <li>{t('refund.process.steps.reply')}</li>
            <li>{t('refund.process.steps.refund')}</li>
          </ol>
          <p>
            {t('refund.process.contactLabel')}
            <a
              href={`mailto:${t('refund.supportEmail')}`}
              className="ml-1 underline"
            >
              {t('refund.supportEmail')}
            </a>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('refund.timeline.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('refund.timeline.body')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
