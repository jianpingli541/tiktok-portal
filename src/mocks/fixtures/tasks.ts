import type { TaskDTO } from '@/lib/api/types';

export const tasksFixture: TaskDTO[] = [
  {
    id: 'task-1',
    status: 'running',
    source_url: 'https://www.tiktok.com/@user/video/1',
    target_language: 'en',
    progress: 45,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'task-2',
    status: 'completed',
    source_url: 'https://www.tiktok.com/@user/video/2',
    target_language: 'es',
    progress: 100,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    output_url: 'https://cdn.example.com/out/task-2.mp4',
  },
];
