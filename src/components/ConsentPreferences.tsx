import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useConsentStore } from '@/stores/consent';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Detailed cookie preferences, embedded on the /privacy page.
 * Unlike `CookieBanner` (which only shows on first visit), this is always
 * reachable so users can change their mind.
 */
export default function ConsentPreferences() {
  const { t } = useTranslation();
  const state = useConsentStore((s) => s.state);
  const save = useConsentStore((s) => s.save);
  const reset = useConsentStore((s) => s.reset);

  const [analytics, setAnalytics] = useState(state.analytics);
  const [marketing, setMarketing] = useState(state.marketing);
  const [savedAt, setSavedAt] = useState<string | null>(state.decidedAt);

  // Re-sync local checkboxes when the store updates (e.g. after Accept All).
  useEffect(() => {
    setAnalytics(state.analytics);
    setMarketing(state.marketing);
    setSavedAt(state.decidedAt);
  }, [state.analytics, state.marketing, state.decidedAt]);

  function handleSave() {
    save(analytics, marketing);
    setSavedAt(new Date().toISOString());
  }

  return (
    <Card data-testid="consent-preferences">
      <CardHeader>
        <CardTitle>{t('consent.preferences.title')}</CardTitle>
        <CardDescription>{t('consent.preferences.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-md border p-3">
          <div>
            <p className="font-medium">{t('consent.categories.necessary')}</p>
            <p className="text-sm text-muted-foreground">
              {t('consent.categories.necessaryDescription')}
            </p>
          </div>
          <span className="shrink-0 rounded bg-secondary px-2 py-1 text-xs">
            {t('consent.categories.alwaysOn')}
          </span>
        </div>
        <label className="flex items-start gap-3 rounded-md border p-3">
          <input
            type="checkbox"
            checked={analytics}
            onChange={(e) => setAnalytics(e.target.checked)}
            className="mt-1 h-4 w-4"
            data-testid="preferences-analytics"
          />
          <span>
            <span className="block font-medium">{t('consent.categories.analytics')}</span>
            <span className="block text-sm text-muted-foreground">
              {t('consent.categories.analyticsDescription')}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-md border p-3">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-1 h-4 w-4"
            data-testid="preferences-marketing"
          />
          <span>
            <span className="block font-medium">{t('consent.categories.marketing')}</span>
            <span className="block text-sm text-muted-foreground">
              {t('consent.categories.marketingDescription')}
            </span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleSave} data-testid="preferences-save">
            {t('consent.preferences.save')}
          </Button>
          <Button variant="outline" onClick={reset} data-testid="preferences-reset">
            {t('consent.preferences.reset')}
          </Button>
          {savedAt && (
            <span className="text-xs text-muted-foreground">
              {t('consent.preferences.lastUpdated', { date: new Date(savedAt).toLocaleString() })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
