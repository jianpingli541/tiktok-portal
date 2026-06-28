import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useAuth } from '@/lib/auth/useAuth';
import { useUIStore } from '@/stores/ui';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LANGUAGES = [
  { code: 'en', labelKey: 'languages.en' },
  { code: 'zh-CN', labelKey: 'languages.zh-CN' },
] as const;

export default function Topbar() {
  const { t, i18n } = useTranslation();
  const { session, logout } = useAuth();
  const toggle = useUIStore((s) => s.toggleSidebar);

  const currentLng = (i18n.resolvedLanguage ?? i18n.language ?? 'en') as string;

  return (
    <header className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={toggle} aria-label={t('common.menu')}>
          ☰
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={t('common.language')}>
              <Globe className="h-4 w-4" />
              <span className="ml-1 text-xs">{currentLng}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {LANGUAGES.map(({ code, labelKey }) => (
              <DropdownMenuItem
                key={code}
                onClick={() => {
                  void i18n.changeLanguage(code);
                  // The LanguageDetector's cache writes to localStorage on
                  // changeLanguage, but we mirror the write defensively in
                  // case the detector is disabled (e.g. jsdom test envs
                  // where localStorage may be unavailable).
                  try {
                    window.localStorage?.setItem('i18nextLng', code);
                  } catch {
                    /* ignore storage failures */
                  }
                }}
                data-active={currentLng === code ? 'true' : undefined}
              >
                {t(labelKey)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="text-sm">{session?.user.email ?? t('common.guest')}</div>
      {session && (
        <Button variant="outline" size="sm" onClick={() => void logout()}>
          {t('common.logout')}
        </Button>
      )}
    </header>
  );
}
