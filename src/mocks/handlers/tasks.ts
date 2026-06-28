import { http, HttpResponse } from 'msw';
import { tasksFixture } from '../fixtures/tasks';
import type { TaskDTO } from '@/lib/api/types';

let tasks: TaskDTO[] = [...tasksFixture];

export const taskHandlers = [
  http.get('/v1/tasks', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const page_size = Number(url.searchParams.get('page_size') ?? '20');
    const start = (page - 1) * page_size;
    return HttpResponse.json({ items: tasks.slice(start, start + page_size), total: tasks.length, page, page_size });
  }),
  http.get('/v1/tasks/:id', ({ params }) => {
    const t = tasks.find((x) => x.id === params.id);
    if (!t) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(t);
  }),
  http.post('/v1/tasks', async ({ request }) => {
    const body = (await request.json()) as { source_url: string; target_language: string };
    const t: TaskDTO = {
      id: `task-${Date.now()}`,
      status: 'pending',
      source_url: body.source_url,
      target_language: body.target_language,
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    tasks = [t, ...tasks];
    return HttpResponse.json(t, { status: 201 });
  }),
  http.post('/v1/tasks/:id/cancel', ({ params }) => {
    tasks = tasks.map((t) => (t.id === params.id ? { ...t, status: 'cancelled' } : t));
    const t = tasks.find((x) => x.id === params.id);
    return t ? HttpResponse.json(t) : new HttpResponse(null, { status: 404 });
  }),
  http.post('/v1/tasks/:id/retry', ({ params }) => {
    tasks = tasks.map((t) => (t.id === params.id ? { ...t, status: 'pending', progress: 0 } : t));
    const t = tasks.find((x) => x.id === params.id);
    return t ? HttpResponse.json(t) : new HttpResponse(null, { status: 404 });
  }),
];
