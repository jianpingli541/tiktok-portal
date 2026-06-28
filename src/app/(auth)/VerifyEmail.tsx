import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function VerifyEmail() {
  const { t } = useTranslation();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? t('auth.verifyEmail.defaultEmail');
  return (
    <div className="mx-auto mt-24 max-w-md">
      <Card>
        <CardHeader><CardTitle>{t('auth.verifyEmail.title')}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p>
            {t('auth.verifyEmail.body', { email: '' }).split('{{email}}')[0]}
            <strong>{email}</strong>
            {t('auth.verifyEmail.body', { email }).split(email).pop()}
          </p>
          <p>
            {t('auth.verifyEmail.afterVerified').split(t('auth.verifyEmail.signIn'))[0]}
            <Link to="/login" className="underline">{t('auth.verifyEmail.signIn')}</Link>
            {t('auth.verifyEmail.afterVerified').split(t('auth.verifyEmail.signIn')).pop()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
