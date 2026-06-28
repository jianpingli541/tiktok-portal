import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConsentStore } from '@/stores/consent';

/**
 * Site footer with legal links + cookie preferences trigger.
 * Mounted in both the AppShell (authenticated) and the marketing layout
 * (public) so legal links are reachable from anywhere.
 */
export default function Footer() {
  const { t } = useTranslation();
  const openConsent = useConsentStore((s) => s.open);

  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm sm:flex-row">
        <p className="text-muted-foreground">
          © {new Date().getFullYear()} {t('common.appName')}. {t('footer.rights')}
        </p>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/privacy" className="text-muted-foreground hover:underline">
            {t('footer.privacy')}
          </Link>
          <Link to="/terms" className="text-muted-foreground hover:underline">
            {t('footer.terms')}
          </Link>
          <Link to="/refund" className="text-muted-foreground hover:underline">
            {t('footer.refund')}
          </Link>
          <button
            type="button"
            onClick={openConsent}
            className="text-muted-foreground hover:underline"
            data-testid="footer-cookie-preferences"
          >
            {t('footer.cookiePreferences')}
          </button>
        </nav>
      </div>
    </footer>
  );
}
