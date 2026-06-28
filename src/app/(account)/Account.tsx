import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Account() {
  const { t } = useTranslation();
  const { session, logout } = useAuth();
  if (!session) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader><CardTitle>{t('account.profile')}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div><span className="text-muted-foreground">{t('account.userId')}</span>{session.user.id}</div>
          <div><span className="text-muted-foreground">{t('account.email')}</span>{session.user.email}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t('account.session')}</CardTitle></CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => void logout()}>
            {t('common.signOut')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
