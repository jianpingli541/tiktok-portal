import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { PlanDTO } from '@/lib/api/types';

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => apiClient.get<PlanDTO[]>('/v1/plans'),
  });
}
