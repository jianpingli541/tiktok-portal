import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Register() {
  const { t } = useTranslation();
  const schema = z.object({
    email: z.string().email({ message: t('auth.validation.invalidEmail') }),
    password: z.string().min(8, { message: t('auth.validation.passwordTooShort') }),
  });
  type FormData = z.infer<typeof schema>;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const plan = params.get('plan');

  async function onSubmit(data: FormData) {
    await registerUser(data.email, data.password);
    navigate('/verify-email', { state: { email: data.email, plan } });
  }

  return (
    <div className="mx-auto mt-24 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>
            {plan ? t('auth.register.titleWithPlan', { plan }) : t('auth.register.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('auth.register.email')}</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="password">{t('auth.register.password')}</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {t('auth.register.submit')}
            </Button>
            <p className="text-center text-sm">
              {t('auth.register.haveAccount')}{' '}
              <Link to="/login" className="underline">{t('auth.register.signIn')}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
