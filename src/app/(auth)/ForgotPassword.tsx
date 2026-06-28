import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const schema = z.object({ email: z.string().email({ message: t('auth.validation.invalidEmail') }) });
  type FormData = z.infer<typeof schema>;
  const { register, handleSubmit, formState: { isSubmitting, isSubmitSuccessful } } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    await apiClient.post('/v1/auth/forgot-password', data);
  }

  return (
    <div className="mx-auto mt-24 max-w-md">
      <Card>
        <CardHeader><CardTitle>{t('auth.forgotPassword.title')}</CardTitle></CardHeader>
        <CardContent>
          {isSubmitSuccessful ? (
            <p>{t('auth.forgotPassword.success')}</p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="email">{t('auth.forgotPassword.email')}</Label>
                <Input id="email" type="email" {...register('email')} />
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {t('auth.forgotPassword.submit')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
