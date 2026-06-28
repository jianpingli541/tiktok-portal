import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTokenStore } from '@/lib/auth/token';

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; requestId: string; scheduledFor: string }
  | { kind: 'error'; message: string };

export default function DataDeletion() {
  const { t } = useTranslation();
  const session = useTokenStore((s) => s.session);

  const schema = z.object({
    confirmationEmail: z
      .string()
      .email({ message: t('auth.validation.invalidEmail') })
      .refine((v) => !session?.user.email || v === session.user.email, {
        message: t('dataDeletion.mustMatchAccount'),
      }),
  });
  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { confirmationEmail: session?.user.email ?? '' },
  });

  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(data: FormData) {
    setStatus({ kind: 'submitting' });
    try {
      const res = await apiClient.post<{
        request_id: string;
        scheduled_for: string;
      }>('/v1/auth/delete-data', {
        confirmation_email: data.confirmationEmail,
      });
      setStatus({
        kind: 'success',
        requestId: res.request_id,
        scheduledFor: res.scheduled_for,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('errors.something_went_wrong');
      setStatus({ kind: 'error', message: msg });
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{t('dataDeletion.title')}</h1>
        <p className="text-base text-muted-foreground">{t('dataDeletion.intro')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">
            {t('dataDeletion.warningTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('dataDeletion.warningBody')}</p>
          <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
            <li>{t('dataDeletion.consequences.account')}</li>
            <li>{t('dataDeletion.consequences.tasks')}</li>
            <li>{t('dataDeletion.consequences.subscription')}</li>
          </ul>
        </CardContent>
      </Card>

      {status.kind === 'success' ? (
        <Card data-testid="deletion-success">
          <CardHeader>
            <CardTitle className="text-green-600">
              {t('dataDeletion.successTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{t('dataDeletion.successBody')}</p>
            <dl className="space-y-1 text-muted-foreground">
              <div>
                <dt className="inline font-medium">{t('dataDeletion.requestId')}: </dt>
                <dd className="inline font-mono">{status.requestId}</dd>
              </div>
              <div>
                <dt className="inline font-medium">{t('dataDeletion.scheduledFor')}: </dt>
                <dd className="inline">
                  {new Date(status.scheduledFor).toLocaleString()}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('dataDeletion.formTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="confirmationEmail">
                  {t('dataDeletion.confirmationEmailLabel')}
                </Label>
                <Input
                  id="confirmationEmail"
                  type="email"
                  autoComplete="email"
                  {...register('confirmationEmail')}
                  data-testid="deletion-email-input"
                />
                {errors.confirmationEmail && (
                  <p className="text-sm text-red-500">
                    {errors.confirmationEmail.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting || status.kind === 'submitting'}
                data-testid="deletion-submit"
              >
                {t('dataDeletion.submit')}
              </Button>
              {status.kind === 'error' && (
                <p className="text-sm text-red-500" data-testid="deletion-error">
                  {status.message}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
