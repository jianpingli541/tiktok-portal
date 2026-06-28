import { useTranslation } from 'react-i18next';
import ConsentPreferences from '@/components/ConsentPreferences';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Privacy() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{t('privacy.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('privacy.lastUpdated', { date: '2026-06-28' })}
        </p>
        <p className="text-base">{t('privacy.intro')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('privacy.dataCollected.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{t('privacy.dataCollected.intro')}</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>{t('privacy.dataCollected.items.email')}</li>
            <li>{t('privacy.dataCollected.items.payment')}</li>
            <li>{t('privacy.dataCollected.items.ip')}</li>
            <li>{t('privacy.dataCollected.items.device')}</li>
            <li>{t('privacy.dataCollected.items.cookies')}</li>
            <li>{t('privacy.dataCollected.items.uploads')}</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('privacy.purposes.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{t('privacy.purposes.intro')}</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>{t('privacy.purposes.items.service')}</li>
            <li>{t('privacy.purposes.items.billing')}</li>
            <li>{t('privacy.purposes.items.security')}</li>
            <li>{t('privacy.purposes.items.improvement')}</li>
            <li>{t('privacy.purposes.items.legal')}</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('privacy.thirdParties.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{t('privacy.thirdParties.intro')}</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>{t('privacy.thirdParties.items.stripe')}</li>
            <li>{t('privacy.thirdParties.items.sentry')}</li>
            <li>{t('privacy.thirdParties.items.hosting')}</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('privacy.rights.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{t('privacy.rights.intro')}</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>{t('privacy.rights.items.access')}</li>
            <li>{t('privacy.rights.items.rectification')}</li>
            <li>{t('privacy.rights.items.deletion')}</li>
            <li>{t('privacy.rights.items.portability')}</li>
            <li>{t('privacy.rights.items.object')}</li>
          </ul>
          <p>
            {t('privacy.rights.contact')}
            <a href={`mailto:${t('privacy.contactEmail')}`} className="ml-1 underline">
              {t('privacy.contactEmail')}
            </a>
            .
          </p>
        </CardContent>
      </Card>

      <ConsentPreferences />

      <Card>
        <CardHeader>
          <CardTitle>{t('privacy.retention.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('privacy.retention.body')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
