import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Landing() {
  const { t } = useTranslation();
  const features = [
    { key: 'multiLanguage', titleKey: 'landing.features.multiLanguage.title', descKey: 'landing.features.multiLanguage.description' },
    { key: 'autoSubtitles', titleKey: 'landing.features.autoSubtitles.title', descKey: 'landing.features.autoSubtitles.description' },
    { key: 'brandSafeColor', titleKey: 'landing.features.brandSafeColor.title', descKey: 'landing.features.brandSafeColor.description' },
  ] as const;
  return (
    <div className="mx-auto max-w-5xl space-y-16 px-4 py-16">
      <section className="space-y-6 text-center">
        <h1 className="text-5xl font-bold">{t('common.appName')}</h1>
        <p className="text-xl text-muted-foreground">{t('landing.tagline')}</p>
        <div className="flex justify-center gap-4">
          <Button asChild><Link to="/register">{t('landing.getStarted')}</Link></Button>
          <Button asChild variant="outline"><Link to="/pricing">{t('landing.viewPricing')}</Link></Button>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {features.map((f) => (
          <Card key={f.key}>
            <CardHeader><CardTitle>{t(f.titleKey)}</CardTitle></CardHeader>
            <CardContent className="text-muted-foreground">{t(f.descKey)}</CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
