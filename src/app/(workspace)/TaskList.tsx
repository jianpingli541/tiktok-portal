import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTasks, useCancelTask } from '@/hooks/useTasks';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STATUSES = ['all', 'pending', 'running', 'completed', 'failed', 'cancelled'] as const;

export default function TaskList() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const { data, isLoading } = useTasks();
  const cancel = useCancelTask();

  const filtered = data?.items.filter((t) => status === 'all' || t.status === status) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Button
            key={s}
            variant={status === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatus(s)}
          >
            {t(`tasks.filter.${s}`)}
          </Button>
        ))}
      </div>
      {isLoading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tasks.table.id')}</TableHead>
              <TableHead>{t('tasks.table.lang')}</TableHead>
              <TableHead>{t('tasks.table.status')}</TableHead>
              <TableHead>{t('tasks.table.progress')}</TableHead>
              <TableHead>{t('tasks.table.created')}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((task) => (
              <TableRow key={task.id}>
                <TableCell><Link to={`/tasks/${task.id}`} className="underline">{task.id}</Link></TableCell>
                <TableCell>{task.target_language}</TableCell>
                <TableCell><Badge>{task.status}</Badge></TableCell>
                <TableCell>{task.progress}%</TableCell>
                <TableCell>{new Date(task.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  {(task.status === 'pending' || task.status === 'running') && (
                    <Button variant="destructive" size="sm" onClick={() => cancel.mutate(task.id)}>
                      {t('common.cancel')}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
