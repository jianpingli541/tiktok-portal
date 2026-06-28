import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Login() {
  const { t } = useTranslation();
  const schema = z.object({
    email: z.string().email({ message: t('auth.validation.invalidEmail') }),
    password: z.string().min(8, { message: t('auth.validation.passwordTooShort') }),
  });
  type FormData = z.infer<typeof schema>;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/submit';

  async function onSubmit(data: FormData) {
    try {
      await login(data.email, data.password);
      navigate(from, { replace: true });
    } catch {
      // toast handled by component
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-md">
      <Card>
        <CardHeader><CardTitle>{t('auth.login.title')}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('auth.login.email')}</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="password">{t('auth.login.password')}</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {t('auth.login.submit')}
            </Button>
            <p className="text-center text-sm">
              {t('auth.login.noAccount')}{' '}
              <Link to="/register" className="underline">{t('auth.login.register')}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
