import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTask, useCancelTask, useRetryTask } from '@/hooks/useTasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const STEP_KEYS = [
  'download',
  'subtitle-removal',
  'asr',
  'translate',
  'tts',
  'merge',
  'subtitle-replace',
  'music',
  'color-grade',
  'save',
] as const;

export default function TaskDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: task, isLoading, error } = useTask(id);
  const cancel = useCancelTask();
  const retry = useRetryTask();

  if (isLoading) return <p>{t('common.loading')}</p>;
  if (error || !task) {
    return (
      <p>
        {t('errors.task_not_found')}{' '}
        <Link to="/tasks" className="underline">{t('common.back')}</Link>
      </p>
    );
  }

  const activeStepIdx = Math.min(Math.floor((task.progress / 100) * STEP_KEYS.length), STEP_KEYS.length - 1);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('tasks.detail.title', { id: task.id })}</CardTitle>
          <Badge>{task.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-muted-foreground">{t('tasks.detail.source')} </span>
            <a href={task.source_url} className="underline">{task.source_url}</a>
          </div>
          <div><span className="text-muted-foreground">{t('tasks.detail.target')}</span>{task.target_language}</div>
          <div><span className="text-muted-foreground">{t('tasks.detail.progress')}</span>{task.progress}%</div>
          {task.output_url && (
            <div>
              <span className="text-muted-foreground">{t('tasks.detail.output')} </span>
              <a href={task.output_url} className="underline" download>{t('common.download')}</a>
            </div>
          )}
          {task.error && <div className="text-red-500">{task.error}</div>}
          <div className="flex gap-2 pt-2">
            {(task.status === 'pending' || task.status === 'running') && (
              <Button variant="destructive" onClick={() => cancel.mutate(task.id)}>
                {t('common.cancel')}
              </Button>
            )}
            {task.status === 'failed' && (
              <Button onClick={() => retry.mutate(task.id)}>{t('common.retry')}</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('tasks.detail.pipelineSteps')}</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {STEP_KEYS.map((s, i) => (
              <li
                key={s}
                className={`flex items-center gap-2 ${i <= activeStepIdx ? 'font-semibold' : 'text-muted-foreground'}`}
              >
                <span className="w-6 text-right">{i + 1}.</span>
                <span className="capitalize">{s.replace('-', ' ')}</span>
                {i === activeStepIdx && task.status === 'running' && <span>⏳</span>}
                {i < activeStepIdx && <span>✓</span>}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
