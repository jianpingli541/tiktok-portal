import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCreateTask } from '@/hooks/useTasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const TIKTOK_HOSTS = ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com'] as const;

export default function Submit() {
  const { t } = useTranslation();
  const schema = z.object({
    source_url: z
      .string()
      .url()
      .max(500)
      .refine((u) => {
        try {
          const h = new URL(u).hostname;
          return TIKTOK_HOSTS.includes(h as (typeof TIKTOK_HOSTS)[number]);
        } catch {
          return false;
        }
      }, t('errors.must_be_tiktok_url')),
    target_language: z.enum(['en', 'es']),
    subtitle_style: z.enum(['classic', 'bold', 'minimal']).optional(),
  });
  type FormData = z.infer<typeof schema>;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { target_language: 'en', subtitle_style: 'classic' },
  });
  const create = useCreateTask();
  const navigate = useNavigate();

  async function onSubmit(data: FormData) {
    const task = await create.mutateAsync(data);
    navigate(`/tasks/${task.id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader><CardTitle>{t('submit.title')}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="source_url">{t('submit.tiktokUrl')}</Label>
              <Input id="source_url" placeholder={t('submit.tiktokUrlPlaceholder')} {...register('source_url')} />
              {errors.source_url && <p className="text-sm text-red-500">{errors.source_url.message}</p>}
            </div>
            <div>
              <Label htmlFor="target_language">{t('submit.targetLanguage')}</Label>
              <select id="target_language" {...register('target_language')} className="w-full rounded border p-2">
                <option value="en">{t('languages.en')}</option>
                <option value="es">{t('languages.es')}</option>
              </select>
            </div>
            <div>
              <Label htmlFor="subtitle_style">{t('submit.subtitleStyle')}</Label>
              <select id="subtitle_style" {...register('subtitle_style')} className="w-full rounded border p-2">
                <option value="classic">{t('subtitleStyles.classic')}</option>
                <option value="bold">{t('subtitleStyles.bold')}</option>
                <option value="minimal">{t('subtitleStyles.minimal')}</option>
              </select>
            </div>
            <Button type="submit" disabled={isSubmitting || create.isPending} className="w-full">
              {t('submit.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
