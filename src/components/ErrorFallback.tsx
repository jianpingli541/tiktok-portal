import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  error?: unknown;
  resetError?: () => void;
}

/**
 * Generic fallback UI shown by <Sentry.ErrorBoundary> when the React tree
 * throws. Intentionally minimal: just a heading, the translated message,
 * and a reset button that triggers boundary remount.
 */
export function ErrorFallback({ error, resetError }: ErrorFallbackProps): React.ReactElement {
  const { t } = useTranslation();
  const defaultMessage = t('errorBoundary.body');
  const message = error instanceof Error ? error.message : defaultMessage;
  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <h1 className="text-2xl font-semibold">{t('errorBoundary.title')}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {resetError ? (
        <Button onClick={resetError} variant="default">
          {t('errorBoundary.reload')}
        </Button>
      ) : null}
    </div>
  );
}

export default ErrorFallback;
