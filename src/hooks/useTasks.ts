import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { TaskDTO, Paginated } from '@/lib/api/types';
import { useTokenStore } from '@/lib/auth/token';

function authHeaders(): Record<string, string> {
  const token = useTokenStore.getState().session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useTasks(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['tasks', page, pageSize],
    queryFn: () =>
      apiClient.get<Paginated<TaskDTO>>(
        `/v1/tasks?page=${page}&page_size=${pageSize}`,
        { headers: authHeaders() },
      ),
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', id],
    enabled: Boolean(id),
    queryFn: () =>
      apiClient.get<TaskDTO>(`/v1/tasks/${id}`, { headers: authHeaders() }),
    refetchInterval: (q) => {
      const s = (q.state.data as TaskDTO | undefined)?.status;
      return s === 'completed' || s === 'failed' || s === 'cancelled' ? false : 5000;
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { source_url: string; target_language: string; subtitle_style?: string }) =>
      apiClient.post<TaskDTO>('/v1/tasks', input, { headers: authHeaders() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useCancelTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<TaskDTO>(`/v1/tasks/${id}/cancel`, undefined, { headers: authHeaders() }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks', id] });
    },
  });
}

export function useRetryTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<TaskDTO>(`/v1/tasks/${id}/retry`, undefined, { headers: authHeaders() }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks', id] });
    },
  });
}
