import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConsentStore } from '@/stores/consent';
import { Button } from '@/components/ui/button';

/**
 * GDPR cookie banner. Mounts globally in Layout.
 *
 * Two modes:
 *  - Compact (default): one-line accept-all / reject-all + "Customize".
 *  - Expanded: shows the three categories with checkboxes (necessary always on).
 *
 * Only renders when the user has not yet decided (`decidedAt === null`).
 * After deciding, the banner disappears; users can re-open via the Footer's
 * "Cookie preferences" link.
 */
export default function CookieBanner() {
  const { t } = useTranslation();
  const state = useConsentStore((s) => s.state);
  const acceptAll = useConsentStore((s) => s.acceptAll);
  const rejectAll = useConsentStore((s) => s.rejectAll);
  const save = useConsentStore((s) => s.save);

  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(state.analytics);
  const [marketing, setMarketing] = useState(state.marketing);

  if (state.decidedAt !== null) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('consent.banner.title')}
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-4 shadow-lg backdrop-blur"
    >
      <div className="mx-auto max-w-5xl space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 text-sm">
            <p className="font-semibold">{t('consent.banner.title')}</p>
            <p className="text-muted-foreground">{t('consent.banner.body')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? t('consent.banner.hideDetails') : t('consent.banner.customize')}
            </Button>
            <Button variant="outline" size="sm" onClick={rejectAll}>
              {t('consent.banner.rejectAll')}
            </Button>
            <Button size="sm" onClick={acceptAll}>
              {t('consent.banner.acceptAll')}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="space-y-3 rounded-md border bg-card p-4 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{t('consent.categories.necessary')}</p>
                <p className="text-muted-foreground">
                  {t('consent.categories.necessaryDescription')}
                </p>
              </div>
              <span className="rounded bg-secondary px-2 py-1 text-xs">
                {t('consent.categories.alwaysOn')}
              </span>
            </div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-1 h-4 w-4"
                data-testid="cookie-analytics"
              />
              <span>
                <span className="block font-medium">{t('consent.categories.analytics')}</span>
                <span className="block text-muted-foreground">
                  {t('consent.categories.analyticsDescription')}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-1 h-4 w-4"
                data-testid="cookie-marketing"
              />
              <span>
                <span className="block font-medium">{t('consent.categories.marketing')}</span>
                <span className="block text-muted-foreground">
                  {t('consent.categories.marketingDescription')}
                </span>
              </span>
            </label>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => save(analytics, marketing)}
                data-testid="cookie-save"
              >
                {t('consent.banner.savePreferences')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
